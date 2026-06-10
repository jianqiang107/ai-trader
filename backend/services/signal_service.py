"""信号生成引擎 — 基于因子数据 + 策略规则生成买卖信号

核心流程：
  1. APScheduler 触发因子计算
  2. 因子更新完成后触发信号评估
  3. 根据策略规则判定买入/卖出条件
  4. 生成信号 (Signal) 并保存到数据库

信号生命周期：
  pending → executed (用户点击买入)
  pending → ignored  (用户主动忽略)
  pending → expired   (24h 未确认自动过期)
  executed → closed   (卖出信号触发或止损止盈触发)
"""

import asyncio
import logging
import random
from datetime import datetime, timedelta, date

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from schemas.common import AppException
from models.strategy import Strategy, UserSubscription
from models.signal import Signal
from models.factor import FactorState
from models.user import User
from services.factor_service import clamp
from services import akshare_service

logger = logging.getLogger(__name__)

# Free 用户每日信号可见上限
FREE_DAILY_SIGNAL_LIMIT = 3

# 主线模式不是独立策略，而是策略中心四类策略的自动组合推荐视图。
MAINLINE_MODES = ("低吸", "趋势", "突破", "均值回归")
MAINLINE_STRATEGY_QUOTAS = {"低吸": 3, "趋势": 3, "突破": 3, "均值回归": 3}
# 个股模式聚焦个股层面的低吸和均值回归机会，不包含 ETF 或主线组合。
STOCK_MODE_MODES = ("低吸", "均值回归")
MIN_RECOMMENDATION_AMOUNT = 50_000_000
RECOMMENDATION_PRESELECT_PER_MODE = 60
RECOMMENDATION_LIMIT = 5
MAX_PER_MODE = 4
MAX_PER_SECTOR = 3


# ---------- 策略规则配置 ----------

STRATEGY_RULES: dict[str, dict] = {
    "低吸": {
        "buy_conditions": {
            "估值优势": (">=", 70),
            "反弹潜力": (">=", 60),
            "市场温度": ("<", 40),
        },
        "sell_conditions": {
            "涨势动力": ("<", 30),
        },
        "weights": {
            "主因子": 0.4,
            "辅因子": 0.25,
            "资金热度": 0.2,
            "市场温度": 0.15,
        },
        "primary_factor": "估值优势",
        "secondary_factor": "反弹潜力",
    },
    "趋势": {
        "buy_conditions": {
            "涨势动力": (">=", 75),
            "突破强度": (">=", 60),
        },
        "sell_conditions": {
            "涨势动力": ("<", 30),
        },
        "weights": {
            "主因子": 0.4,
            "辅因子": 0.25,
            "资金热度": 0.2,
            "市场温度": 0.15,
        },
        "primary_factor": "涨势动力",
        "secondary_factor": "突破强度",
    },
    "突破": {
        "buy_conditions": {
            "突破强度": (">=", 80),
            "资金热度": (">=", 60),
        },
        "sell_conditions": {
            "突破强度": ("<", 20),
        },
        "weights": {
            "主因子": 0.4,
            "辅因子": 0.25,
            "资金热度": 0.2,
            "市场温度": 0.15,
        },
        "primary_factor": "突破强度",
        "secondary_factor": "资金热度",
    },
    "均值回归": {
        "buy_conditions": {
            "震荡程度": (">=", 65),
            "估值优势": (">=", 50),
        },
        "sell_conditions": {
            "震荡程度": ("<", 20),
        },
        "weights": {
            "主因子": 0.4,
            "辅因子": 0.25,
            "资金热度": 0.2,
            "市场温度": 0.15,
        },
        "primary_factor": "震荡程度",
        "secondary_factor": "估值优势",
    },
}

# 来自 docs/plans/2026-06-01-ai-trader-strategy-spec.md 的产品标签权重。
# 当前用于统一策略口径；后续接入完整因子数据后，可直接作为策略评分入口。
STRATEGY_LABEL_WEIGHTS: dict[str, dict[str, float]] = {
    "低吸": {"反弹潜力": 0.35, "资金热度": 0.25, "估值优势": 0.25, "涨势动力": 0.15},
    "趋势": {"涨势动力": 0.35, "资金热度": 0.30, "市场温度": 0.20, "震荡程度": 0.15},
    "突破": {"突破强度": 0.30, "资金热度": 0.30, "涨势动力": 0.25, "震荡程度": 0.15},
    "均值回归": {"反弹潜力": 0.30, "估值优势": 0.30, "震荡程度": 0.25, "市场温度": 0.15},
}

# 止损止盈默认比例
DEFAULT_STOP_TAKE: dict[str, dict[str, float]] = {
    "低吸": {"stop_loss_pct": 0.05, "take_profit_pct": 0.10},
    "趋势": {"stop_loss_pct": 0.07, "take_profit_pct": 0.15},
    "突破": {"stop_loss_pct": 0.05, "take_profit_pct": 0.12},
    "均值回归": {"stop_loss_pct": 0.04, "take_profit_pct": 0.08},
}

# ---------- 置信度计算 ----------


def calc_confidence(strategy_type: str, factors: dict[str, float]) -> int:
    """根据因子得分计算信号置信度

    confidence = w1*主因子 + w2*辅因子 + w3*资金热度 + w4*市场温度

    Args:
        strategy_type: 策略类型
        factors: 因子名称 → 分值映射

    Returns:
        0-100 的置信度
    """
    label_weights = STRATEGY_LABEL_WEIGHTS.get(strategy_type)
    if label_weights is not None:
        confidence = sum(weight * factors.get(label, 0) for label, weight in label_weights.items())
        return int(clamp(round(confidence), 0, 100))

    rule = STRATEGY_RULES.get(strategy_type)
    if rule is None:
        return 50

    weights = rule["weights"]
    primary_factor = rule["primary_factor"]
    secondary_factor = rule["secondary_factor"]

    confidence = (
        weights["主因子"] * factors.get(primary_factor, 0)
        + weights["辅因子"] * factors.get(secondary_factor, 0)
        + weights["资金热度"] * factors.get("资金热度", 0)
        + weights["市场温度"] * factors.get("市场温度", 0)
    )

    return int(clamp(round(confidence), 0, 100))


# ---------- 止损止盈价格计算 ----------


def calc_stop_loss_take_profit(
    signal_price: float,
    mode: str,
) -> tuple[float, float]:
    """根据策略模式计算默认止损止盈价格

    Args:
        signal_price: 信号价格
        mode: 策略模式 (低吸/趋势/突破/均值回归)

    Returns:
        (止损价, 止盈价)
    """
    params = DEFAULT_STOP_TAKE.get(mode, {"stop_loss_pct": 0.05, "take_profit_pct": 0.10})
    stop_loss_price = round(signal_price * (1 - params["stop_loss_pct"]), 4)
    take_profit_price = round(signal_price * (1 + params["take_profit_pct"]), 4)
    return stop_loss_price, take_profit_price


# ---------- 条件评估 ----------


def _check_condition(
    factor_value: float,
    operator: str,
    threshold: float,
) -> bool:
    """检查单个因子条件是否满足"""
    if operator == ">=":
        return factor_value >= threshold
    elif operator == "<=":
        return factor_value <= threshold
    elif operator == ">":
        return factor_value > threshold
    elif operator == "<":
        return factor_value < threshold
    elif operator == "==":
        return factor_value == threshold
    return False


def _evaluate_conditions(
    conditions: dict[str, tuple[str, float]],
    factors: dict[str, float],
) -> bool:
    """评估所有条件是否全部满足

    Args:
        conditions: {因子标签: (操作符, 阈值)}
        factors: 当前因子分值

    Returns:
        True 表示全部满足
    """
    for label, (operator, threshold) in conditions.items():
        factor_value = factors.get(label, 0.0)
        if not _check_condition(factor_value, operator, threshold):
            return False
    return True


# ---------- 信号生成主入口 ----------


async def evaluate_and_generate_signals(db: AsyncSession) -> list[Signal]:
    """评估所有策略的因子，触发信号生成

    遍历所有活跃策略，获取最新因子，检查买入/卖出条件，
    如满足则生成对应信号。

    Args:
        db: 异步数据库会话

    Returns:
        新生成的信号列表
    """
    # 查询所有活跃策略
    stmt = select(Strategy).where(Strategy.is_active == True)  # noqa: E712
    result = await db.execute(stmt)
    strategies = result.scalars().all()

    new_signals: list[Signal] = []

    for strategy in strategies:
        rule = STRATEGY_RULES.get(strategy.type)
        if rule is None:
            continue

        # 获取该策略的最新因子
        factor_stmt = select(FactorState).where(
            FactorState.strategy_id == strategy.id
        )
        factor_result = await db.execute(factor_stmt)
        factor_states = factor_result.scalars().all()

        if not factor_states:
            continue

        # 构建因子映射
        factors: dict[str, float] = {f.label: f.value for f in factor_states}

        # --- 检查买入条件 ---
        buy_conditions = rule.get("buy_conditions", {})
        if buy_conditions and _evaluate_conditions(buy_conditions, factors):
            # 检查是否已存在该策略的 pending BUY 信号（去重）
            existing_buy = await db.scalar(
                select(func.count(Signal.id)).where(
                    Signal.strategy_id == strategy.id,
                    Signal.signal_type == "BUY",
                    Signal.status == "pending",
                )
            )
            if existing_buy == 0:
                signal = await _create_buy_signal(
                    strategy=strategy,
                    factors=factors,
                    db=db,
                )
                if signal is not None:
                    new_signals.append(signal)

        # --- 检查卖出条件 ---
        sell_conditions = rule.get("sell_conditions", {})
        if sell_conditions and _evaluate_conditions(sell_conditions, factors):
            # 查找该策略下 executed 状态的信号，标记为 closed
            executed_signals = await db.execute(
                select(Signal).where(
                    Signal.strategy_id == strategy.id,
                    Signal.signal_type == "BUY",
                    Signal.status == "executed",
                )
            )
            for sig in executed_signals.scalars().all():
                sig.status = "closed"
                sig.actual_pnl = None
                db.add(sig)

    if new_signals:
        await db.commit()
        logger.info("信号生成完成, 新信号=%d", len(new_signals))

    return new_signals


async def _create_buy_signal(
    strategy: Strategy,
    factors: dict[str, float],
    db: AsyncSession,
) -> Signal | None:
    """创建买入信号

    Args:
        strategy: 策略 ORM 对象
        factors: 因子映射
        db: 数据库会话

    Returns:
        新建的 Signal 对象，或 None
    """
    logger.warning("真实行情选股未接入，跳过策略 %s 的信号生成", strategy.id)
    return None


# ---------- 择时信号 ----------


async def get_timing_signals(
    date: str | None,
    mode: str | None,
    user_id: str,
    db: AsyncSession,
) -> list[dict]:
    """获取择时信号

    Args:
        date: 日期筛选 (YYYY-MM-DD)
        mode: 策略模式筛选
        user_id: 用户 ID
        db: 数据库会话

    Returns:
        择时信号列表
    """
    stmt = select(Signal).where(Signal.status != "expired")

    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            stmt = stmt.where(
                func.date(Signal.signal_time) == target_date
            )
        except ValueError:
            pass

    if mode:
        if mode == "主线":
            stmt = stmt.where(Signal.mode.in_(MAINLINE_MODES))
        elif mode == "个股":
            stmt = stmt.where(Signal.mode.in_(STOCK_MODE_MODES))
        elif mode != "汇总":
            stmt = stmt.where(Signal.mode == mode)

    # 仅返回用户已订阅策略的信号
    sub_stmt = select(UserSubscription.strategy_id).where(
        UserSubscription.user_id == user_id
    )
    sub_result = await db.execute(sub_stmt)
    subscribed_ids = [row[0] for row in sub_result.all()]
    if subscribed_ids:
        stmt = stmt.where(Signal.strategy_id.in_(subscribed_ids))
    else:
        stmt = stmt.where(Signal.id == "")

    stmt = stmt.order_by(Signal.signal_time.desc())
    result = await db.execute(stmt)
    signals = result.scalars().all()

    persisted_signals = [_signal_to_dict(s) for s in signals]
    realtime_signals = await _build_realtime_timing_signals(
        date_str=date,
        mode=mode,
        subscribed_strategy_ids=subscribed_ids,
        db=db,
    )

    existing_codes = {s["stock_code"] for s in persisted_signals}
    merged = persisted_signals + [s for s in realtime_signals if s["stock_code"] not in existing_codes]
    return merged


async def _get_subscribed_strategy_types(
    subscribed_strategy_ids: list[str],
    db: AsyncSession,
) -> set[str]:
    if not subscribed_strategy_ids:
        return set()
    result = await db.execute(select(Strategy.type).where(Strategy.id.in_(subscribed_strategy_ids)))
    return {row[0] for row in result.all()}


def _is_today(date_str: str | None) -> bool:
    if not date_str:
        return True
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date() == date.today()
    except ValueError:
        return False


def _allowed_modes(mode: str | None) -> tuple[str, ...]:
    if mode == "主线":
        return MAINLINE_MODES
    if mode == "个股":
        return STOCK_MODE_MODES
    if mode in STRATEGY_RULES:
        return (mode,)
    if mode == "汇总" or mode is None:
        return tuple(STRATEGY_RULES.keys())
    return tuple()


def _score_realtime_stock(stock: dict, mode: str) -> int:
    change_pct = float(stock.get("change_pct") or 0)
    turnover_rate = float(stock.get("turnover_rate") or 0)
    amplitude = float(stock.get("amplitude") or 0)
    amount = float(stock.get("amount") or 0)
    amount_score = min(amount / 10_000_000_000 * 20, 20)
    sector_heat = _sector_heat_score(stock)
    limit_up_score = _limit_up_candidate_score(stock)

    if mode == "趋势":
        score = 45 + change_pct * 7 + min(turnover_rate, 8) * 3 + amount_score + sector_heat * 0.12
    elif mode == "突破":
        score = 40 + max(change_pct, 0) * 5 + min(turnover_rate, 10) * 4 + min(amplitude, 8) * 3 + limit_up_score * 0.25
    elif mode == "低吸":
        dip_score = max(0, min(3, -change_pct)) * 12
        strong_dip_score = min(limit_up_score, 35) if 3 <= change_pct < 9.8 else 0
        score = 50 + dip_score + strong_dip_score + min(turnover_rate, 6) * 3 + amount_score + sector_heat * 0.16
    elif mode == "均值回归":
        score = 45 + max(0, min(6, amplitude)) * 5 + max(0, 2 - abs(change_pct)) * 8 + sector_heat * 0.08
    else:
        score = 0

    return int(clamp(round(score), 0, 100))


def _sector_heat_score(stock: dict) -> float:
    return float(stock.get("sector_heat") or 0)


def _limit_up_candidate_score(stock: dict) -> float:
    change_pct = float(stock.get("change_pct") or 0)
    turnover_rate = float(stock.get("turnover_rate") or 0)
    amount = float(stock.get("amount") or 0)
    sector_heat = _sector_heat_score(stock)
    if change_pct < 3 or change_pct >= 10.05:
        return 0
    distance_score = max(0, 10 - change_pct) * 3 if change_pct < 9.7 else 35
    liquidity_score = min(amount / 5_000_000_000 * 20, 20)
    turnover_score = min(turnover_rate, 8) * 3
    return min(100, sector_heat * 0.35 + distance_score + liquidity_score + turnover_score)


def _threshold_for_mode(mode: str) -> int:
    return 70 if mode in ("趋势", "突破") else 65


def _explain_realtime_stock(stock: dict, mode: str, confidence: int, source: str) -> dict:
    change_pct = float(stock.get("change_pct") or 0)
    turnover_rate = float(stock.get("turnover_rate") or 0)
    amplitude = float(stock.get("amplitude") or 0)
    amount = float(stock.get("amount") or 0)
    amount_yi = amount / 100_000_000
    sector_name = str(stock.get("sector_name") or "相关板块")
    sector_heat = _sector_heat_score(stock)
    limit_up_score = _limit_up_candidate_score(stock)

    score_breakdown = {
        "涨跌幅": round(change_pct, 2),
        "换手率": round(turnover_rate, 2),
        "振幅": round(amplitude, 2),
        "成交额_亿": round(amount_yi, 2),
        "sector_heat": round(sector_heat, 2),
        "涨停候选分": round(limit_up_score, 2),
        "综合分": confidence,
    }

    if mode == "趋势":
        reasons = [
            f"涨跌幅 {change_pct:.2f}% 显示短线趋势强度",
            f"成交额 {amount_yi:.1f} 亿，流动性满足观察条件",
            f"换手率 {turnover_rate:.2f}% 支撑趋势延续判断",
        ]
    elif mode == "突破":
        reasons = [
            f"{sector_name}板块强度 {sector_heat:.0f}，具备题材联动基础",
            f"涨停候选分 {limit_up_score:.0f}，涨幅 {change_pct:.2f}% 接近突破确认区",
            f"成交额 {amount_yi:.1f} 亿，具备量能基础",
        ]
    elif mode == "低吸":
        if limit_up_score >= 55 and change_pct >= 3:
            limit_up_text = (
                f"当前涨幅 {change_pct:.2f}% 已接近/触及涨停，只适合等待开板回踩承接"
                if change_pct >= 9.7
                else f"当前涨幅 {change_pct:.2f}% 仍在涨停候选区"
            )
            reasons = [
                f"强势低吸：{sector_name}板块强度 {sector_heat:.0f}，题材内有涨停候选",
                f"涨停候选分 {limit_up_score:.0f}，{limit_up_text}",
                f"成交额 {amount_yi:.1f} 亿、换手率 {turnover_rate:.2f}%，适合观察回踩承接",
            ]
        else:
            reasons = [
                f"涨跌幅 {change_pct:.2f}% 后进入低吸观察区",
                f"成交额 {amount_yi:.1f} 亿，流动性尚可",
                f"换手率 {turnover_rate:.2f}% 支持分批观察",
            ]
    else:
        reasons = [
            f"振幅 {amplitude:.2f}% 显示均值回归空间",
            f"涨跌幅 {change_pct:.2f}% 接近修复观察区",
            f"成交额 {amount_yi:.1f} 亿，交易活跃度可观察",
        ]

    return {
        "reasons": reasons,
        "score_breakdown": score_breakdown,
        "data_source": source == "tencent" and "tencent" or source,
    }


def _is_tradeable_candidate(stock: dict) -> bool:
    name = str(stock.get("name") or "")
    price = float(stock.get("price") or 0)
    volume = float(stock.get("volume") or 0)
    return (
        "ST" not in name.upper()
        and "退" not in name
        and price > 1
        and volume > 0
    )


def _filter_recommendation_universe(stocks: list[dict]) -> list[dict]:
    result = []
    for stock in stocks:
        name = str(stock.get("name") or "")
        code = str(stock.get("code") or "")
        price = float(stock.get("price") or 0)
        volume = float(stock.get("volume") or 0)
        amount = float(stock.get("amount") or 0)
        if not code or not name:
            continue
        if "ST" in name.upper() or "退" in name:
            continue
        if price <= 1 or volume <= 0 or amount < MIN_RECOMMENDATION_AMOUNT:
            continue
        result.append(stock)
    return result


def _preselection_score(stock: dict, mode: str) -> float:
    change_pct = float(stock.get("change_pct") or 0)
    turnover_rate = float(stock.get("turnover_rate") or 0)
    amplitude = float(stock.get("amplitude") or 0)
    amount = float(stock.get("amount") or 0)
    liquidity = min(amount / 1_000_000_000, 10)

    if mode == "低吸":
        return max(0, -change_pct) * 3 + amplitude + liquidity
    if mode == "趋势":
        return max(0, change_pct) * 3 + turnover_rate + liquidity
    if mode == "突破":
        return max(0, change_pct) * 2 + turnover_rate * 1.5 + amplitude + liquidity
    return max(0, 2 - abs(change_pct)) * 3 + amplitude + liquidity


def _preselect_recommendation_candidates(
    stocks: list[dict],
    per_mode_limit: int = RECOMMENDATION_PRESELECT_PER_MODE,
) -> dict[str, list[dict]]:
    result = {}
    for mode in MAINLINE_MODES:
        ranked = sorted(
            stocks,
            key=lambda stock: _preselection_score(stock, mode),
            reverse=True,
        )
        result[mode] = ranked[:per_mode_limit]
    return result


def _realtime_signal_from_stock(
    stock: dict,
    mode: str,
    confidence: int,
    source: str,
    *,
    trade_date: str | None = None,
    secondary_modes: list[str] | None = None,
    market_rank: int | None = None,
    quote_updated_at: str | None = None,
) -> dict:
    price = float(stock.get("price") or 0)
    stop_loss, take_profit = calc_stop_loss_take_profit(price, mode)
    code = str(stock.get("code") or "")
    explanation = _explain_realtime_stock(stock, mode, confidence, source)
    current_trade_date = trade_date or date.today().isoformat()
    return {
        "id": f"rt-{current_trade_date}-{mode}-{code}",
        "stock_code": code,
        "stock_name": stock.get("name") or code,
        "signal_type": "BUY",
        "strategy_id": f"realtime-{mode}",
        "signal_time": datetime.utcnow().isoformat(),
        "signal_price": price,
        "mode": mode,
        "confidence": confidence,
        "status": "pending",
        "stop_loss_price": stop_loss,
        "take_profit_price": take_profit,
        "alert_status": "safe",
        "actual_pnl": None,
        "holding_days": None,
        "current_price": price,
        "floating_pnl": None,
        "secondary_modes": secondary_modes or [],
        "market_rank": market_rank,
        "quote_updated_at": quote_updated_at,
        "sector_name": str(stock.get("sector_name") or ""),
        **explanation,
    }


def _select_diversified_recommendations(
    candidates_by_mode: dict[str, list[dict]],
    limit: int = RECOMMENDATION_LIMIT,
) -> list[dict]:
    all_candidates = [
        signal
        for mode_candidates in candidates_by_mode.values()
        for signal in mode_candidates
    ]
    all_candidates.sort(
        key=lambda signal: (
            int(signal.get("confidence") or 0),
            float(signal.get("score_breakdown", {}).get("成交额_亿") or 0),
        ),
        reverse=True,
    )

    selected = []
    selected_codes = set()
    mode_counts = {mode: 0 for mode in MAINLINE_MODES}
    sector_counts: dict[str, int] = {}

    for signal in all_candidates:
        code = signal["stock_code"]
        mode = signal["mode"]
        sector = signal.get("sector_name") or ""
        if code in selected_codes:
            continue
        if mode_counts.get(mode, 0) >= MAX_PER_MODE:
            continue
        if sector and sector_counts.get(sector, 0) >= MAX_PER_SECTOR:
            continue

        selected.append(signal)
        selected_codes.add(code)
        mode_counts[mode] = mode_counts.get(mode, 0) + 1
        if sector:
            sector_counts[sector] = sector_counts.get(sector, 0) + 1
        if len(selected) >= limit:
            break

    for rank, signal in enumerate(selected, start=1):
        signal["market_rank"] = rank
    return selected


def _build_diversified_realtime_signals(
    preselected: dict[str, list[dict]],
    allowed_modes: list[str],
    source: str,
    limit: int = RECOMMENDATION_LIMIT,
    quote_updated_at: str | None = None,
) -> list[dict]:
    passing_by_code: dict[str, list[tuple[str, int]]] = {}
    stock_by_code: dict[str, dict] = {}
    for candidate_mode in allowed_modes:
        for stock in preselected.get(candidate_mode, []):
            confidence = _score_realtime_stock(stock, candidate_mode)
            if confidence >= _threshold_for_mode(candidate_mode):
                code = str(stock.get("code") or "")
                stock_by_code[code] = stock
                passing_by_code.setdefault(code, []).append((candidate_mode, confidence))

    candidates_by_mode: dict[str, list[dict]] = {mode: [] for mode in allowed_modes}
    for code, passing_modes in passing_by_code.items():
        passing_modes.sort(key=lambda item: item[1], reverse=True)
        primary_mode, confidence = passing_modes[0]
        signal = _realtime_signal_from_stock(
            stock_by_code[code],
            primary_mode,
            confidence,
            source,
            secondary_modes=[mode for mode, _ in passing_modes[1:]],
            quote_updated_at=quote_updated_at,
        )
        candidates_by_mode.setdefault(primary_mode, []).append(signal)

    return _select_diversified_recommendations(candidates_by_mode, limit=limit)


async def _build_realtime_timing_signals(
    date_str: str | None,
    mode: str | None,
    subscribed_strategy_ids: list[str],
    db: AsyncSession,
) -> list[dict]:
    if not _is_today(date_str):
        return []

    _ = subscribed_strategy_ids, db
    allowed_modes = list(_allowed_modes(mode))
    if not allowed_modes:
        return []

    stock_data = await asyncio.to_thread(akshare_service.get_full_market_stock_list)
    source = stock_data.get("source", "unavailable")
    if source != "eastmoney":
        logger.warning("全市场行情源不可用，跳过实时推荐生成: source=%s", source)
        return []

    stocks = _filter_recommendation_universe(stock_data.get("items", []))
    preselected = _preselect_recommendation_candidates(stocks)
    return _build_diversified_realtime_signals(
        preselected,
        allowed_modes,
        source,
        quote_updated_at=stock_data.get("quote_updated_at"),
    )


# ---------- 市场情绪信号 (mock) ----------


async def get_emotion1_data(date_str: str | None) -> list[dict]:
    """获取市场情绪数据1 — 恐惧贪婪指数

    MVP: 返回 mock 数据

    Args:
        date_str: 日期 (YYYY-MM-DD)

    Returns:
        情绪数据点列表
    """
    target_date = datetime.strptime(date_str, "%Y-%m-%d") if date_str else datetime.utcnow()
    result = []
    for i in range(30):
        d = target_date - timedelta(days=29 - i)
        result.append({
            "date": d.strftime("%Y-%m-%d"),
            "value": round(random.uniform(20, 80), 2),
        })
    return result


async def get_emotion2_data(date_str: str | None) -> list[dict]:
    """获取市场情绪数据2 — 资金流向

    MVP: 返回 mock 数据

    Args:
        date_str: 日期 (YYYY-MM-DD)

    Returns:
        资金流向数据点列表
    """
    target_date = datetime.strptime(date_str, "%Y-%m-%d") if date_str else datetime.utcnow()
    result = []
    for i in range(30):
        d = target_date - timedelta(days=29 - i)
        result.append({
            "date": d.strftime("%Y-%m-%d"),
            "inflow": round(random.uniform(50, 300), 2),
            "outflow": round(random.uniform(40, 280), 2),
        })
    return result


# ---------- 实盘信号 ----------


async def get_live_signals(
    filter_data: dict,
    user_id: str,
    user_plan: str,
    db: AsyncSession,
) -> list[dict]:
    """获取实盘信号列表

    规则：
      - 仅返回用户已订阅策略的信号
      - Free 用户每日可见上限 3 条
      - 支持按类型/周期/搜索/持仓/预警筛选

    Args:
        filter_data: 筛选条件字典
        user_id: 用户 ID
        user_plan: 用户会员等级
        db: 数据库会话

    Returns:
        实盘信号列表
    """
    # 查询用户已订阅策略
    sub_stmt = select(UserSubscription.strategy_id).where(
        UserSubscription.user_id == user_id
    )
    sub_result = await db.execute(sub_stmt)
    subscribed_ids = [row[0] for row in sub_result.all()]

    # 基础查询
    stmt = select(Signal).where(
        Signal.strategy_id.in_(subscribed_ids),
        Signal.status.in_(["pending", "executed"]),
    )

    # 类型筛选
    signal_type = filter_data.get("type")
    if signal_type and signal_type != "all":
        stmt = stmt.where(Signal.signal_type == signal_type)

    # 周期筛选
    period = filter_data.get("period", "today")
    now = datetime.utcnow()
    if period == "today":
        stmt = stmt.where(func.date(Signal.signal_time) == now.date())
    elif period == "week":
        week_start = now - timedelta(days=now.weekday())
        stmt = stmt.where(Signal.signal_time >= week_start)
    elif period == "month":
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        stmt = stmt.where(Signal.signal_time >= month_start)

    # 搜索
    search = filter_data.get("search")
    if search:
        stmt = stmt.where(
            (Signal.stock_code.contains(search))
            | (Signal.stock_name.contains(search))
        )

    # 仅持仓
    only_holding = filter_data.get("onlyHolding", False)
    if only_holding:
        stmt = stmt.where(Signal.status == "executed")

    # 仅预警
    only_alerting = filter_data.get("onlyAlerting", False)
    if only_alerting:
        stmt = stmt.where(Signal.alert_status.in_(["warning", "stop_loss", "take_profit"]))

    stmt = stmt.order_by(Signal.signal_time.desc())

    result = await db.execute(stmt)
    signals = result.scalars().all()
    live_signals = [_signal_to_dict(s) for s in signals]

    realtime_live_signals: list[dict] = []
    if (
        period == "today"
        and (not signal_type or signal_type in ("all", "BUY"))
        and not only_holding
        and not only_alerting
    ):
        realtime_live_signals = await _build_realtime_timing_signals(
            date_str=date.today().strftime("%Y-%m-%d"),
            mode="汇总",
            subscribed_strategy_ids=subscribed_ids,
            db=db,
        )
        if search:
            realtime_live_signals = [
                s for s in realtime_live_signals
                if search in s["stock_code"] or search in s["stock_name"]
            ]

    existing_codes = {s["stock_code"] for s in live_signals}
    live_signals.extend([s for s in realtime_live_signals if s["stock_code"] not in existing_codes])

    # Free 用户每日可见上限
    if user_plan == "free" and len(live_signals) > FREE_DAILY_SIGNAL_LIMIT:
        live_signals = live_signals[:FREE_DAILY_SIGNAL_LIMIT]

    return live_signals


async def get_live_stats(
    user_id: str,
    db: AsyncSession,
) -> dict:
    """获取实盘信号统计

    Args:
        user_id: 用户 ID
        db: 数据库会话

    Returns:
        统计数据
    """
    # 查询用户已订阅策略
    sub_stmt = select(UserSubscription.strategy_id).where(
        UserSubscription.user_id == user_id
    )
    sub_result = await db.execute(sub_stmt)
    subscribed_ids = [row[0] for row in sub_result.all()]

    now = datetime.utcnow()
    today = now.date()

    # 今日信号数
    today_count = await db.scalar(
        select(func.count(Signal.id)).where(
            Signal.strategy_id.in_(subscribed_ids),
            func.date(Signal.signal_time) == today,
        )
    ) or 0
    realtime_stats_signals = await _build_realtime_timing_signals(
        date_str=today.strftime("%Y-%m-%d"),
        mode="汇总",
        subscribed_strategy_ids=subscribed_ids,
        db=db,
    )
    today_count += len(realtime_stats_signals)

    # 持仓中 (executed)
    holding = await db.scalar(
        select(func.count(Signal.id)).where(
            Signal.strategy_id.in_(subscribed_ids),
            Signal.status == "executed",
        )
    ) or 0

    # 止盈触发
    take_profit = await db.scalar(
        select(func.count(Signal.id)).where(
            Signal.strategy_id.in_(subscribed_ids),
            Signal.alert_status == "take_profit",
        )
    ) or 0

    # 止损触发
    stop_loss = await db.scalar(
        select(func.count(Signal.id)).where(
            Signal.strategy_id.in_(subscribed_ids),
            Signal.alert_status == "stop_loss",
        )
    ) or 0

    # 预警中
    alerting = await db.scalar(
        select(func.count(Signal.id)).where(
            Signal.strategy_id.in_(subscribed_ids),
            Signal.alert_status.in_(["warning", "stop_loss", "take_profit"]),
        )
    ) or 0

    return {
        "today_count": today_count,
        "holding": holding,
        "take_profit": take_profit,
        "stop_loss": stop_loss,
        "alerting": alerting,
    }


# ---------- 信号操作 ----------


async def execute_signal(
    signal_id: str,
    user_id: str,
    db: AsyncSession,
) -> None:
    """执行信号 (pending → executed)

    Args:
        signal_id: 信号 ID
        user_id: 用户 ID
        db: 数据库会话

    Raises:
        AppException: 信号不存在 (3001) / 状态不允许 (3002)
    """
    if signal_id.startswith("rt-"):
        logger.info("实时信号 %s 已执行 by 用户 %s (no-op)", signal_id, user_id)
        return

    stmt = select(Signal).where(Signal.id == signal_id)
    result = await db.execute(stmt)
    signal = result.scalars().first()

    if signal is None:
        raise AppException(code=3001, message="信号不存在", data=None)

    if signal.status != "pending":
        raise AppException(
            code=3002,
            message=f"信号状态为 {signal.status}，不允许执行",
            data=None,
        )

    signal.status = "executed"
    db.add(signal)
    await db.commit()
    logger.info("信号 %s 已执行 by 用户 %s", signal_id, user_id)


async def ignore_signal(
    signal_id: str,
    user_id: str,
    db: AsyncSession,
) -> None:
    """忽略信号 (pending → ignored)

    Args:
        signal_id: 信号 ID
        user_id: 用户 ID
        db: 数据库会话

    Raises:
        AppException: 信号不存在 (3001) / 状态不允许 (3002)
    """
    if signal_id.startswith("rt-"):
        logger.info("实时信号 %s 已忽略 by 用户 %s (no-op)", signal_id, user_id)
        return

    stmt = select(Signal).where(Signal.id == signal_id)
    result = await db.execute(stmt)
    signal = result.scalars().first()

    if signal is None:
        raise AppException(code=3001, message="信号不存在", data=None)

    if signal.status != "pending":
        raise AppException(
            code=3002,
            message=f"信号状态为 {signal.status}，不允许忽略",
            data=None,
        )

    signal.status = "ignored"
    db.add(signal)
    await db.commit()
    logger.info("信号 %s 已忽略 by 用户 %s", signal_id, user_id)


async def set_alert(
    signal_id: str,
    setting: dict,
    user_id: str,
    db: AsyncSession,
) -> None:
    """设置止损止盈预警

    Args:
        signal_id: 信号 ID
        setting: 预警设置 {stop_loss_price, take_profit_price, alert_method, alert_frequency}
        user_id: 用户 ID
        db: 数据库会话

    Raises:
        AppException: 信号不存在 (3001)
    """
    if signal_id.startswith("rt-"):
        logger.info("实时信号 %s 预警设置 by 用户 %s (no-op)", signal_id, user_id)
        return

    stmt = select(Signal).where(Signal.id == signal_id)
    result = await db.execute(stmt)
    signal = result.scalars().first()

    if signal is None:
        raise AppException(code=3001, message="信号不存在", data=None)

    # 更新止损止盈价格
    if "stop_loss_price" in setting and setting["stop_loss_price"] is not None:
        signal.stop_loss_price = setting["stop_loss_price"]
    if "take_profit_price" in setting and setting["take_profit_price"] is not None:
        signal.take_profit_price = setting["take_profit_price"]

    db.add(signal)
    await db.commit()
    logger.info("信号 %s 预警设置已更新 by 用户 %s", signal_id, user_id)


# ---------- 信号过期 ----------


async def expire_signals(db: AsyncSession) -> int:
    """将超过 24h 的 pending 信号标记为 expired

    Args:
        db: 数据库会话

    Returns:
        过期信号数量
    """
    cutoff = datetime.utcnow() - timedelta(hours=24)
    stmt = select(Signal).where(
        Signal.status == "pending",
        Signal.signal_time < cutoff,
    )
    result = await db.execute(stmt)
    signals = result.scalars().all()

    count = 0
    for sig in signals:
        sig.status = "expired"
        db.add(sig)
        count += 1

    if count > 0:
        await db.commit()
        logger.info("已过期 %d 条信号", count)

    return count


# ---------- 内部辅助 ----------


def _signal_to_dict(s: Signal) -> dict:
    """将 Signal ORM 对象转换为 API 输出字典"""
    # 计算持仓天数
    holding_days = None
    if s.status == "executed" and s.signal_time:
        holding_days = (datetime.utcnow() - s.signal_time).days

    current_price = None
    floating_pnl = None

    return {
        "id": s.id,
        "stock_code": s.stock_code,
        "stock_name": s.stock_name,
        "signal_type": s.signal_type,
        "strategy_id": s.strategy_id,
        "signal_time": s.signal_time.isoformat() if s.signal_time else None,
        "signal_price": s.signal_price,
        "mode": s.mode,
        "confidence": s.confidence,
        "status": s.status,
        "stop_loss_price": s.stop_loss_price,
        "take_profit_price": s.take_profit_price,
        "alert_status": s.alert_status,
        "actual_pnl": s.actual_pnl,
        "holding_days": holding_days,
        "current_price": current_price,
        "floating_pnl": floating_pnl,
    }

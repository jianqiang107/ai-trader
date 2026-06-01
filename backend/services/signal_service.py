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

logger = logging.getLogger(__name__)

# Free 用户每日信号可见上限
FREE_DAILY_SIGNAL_LIMIT = 3


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

# 止损止盈默认比例
DEFAULT_STOP_TAKE: dict[str, dict[str, float]] = {
    "低吸": {"stop_loss_pct": 0.05, "take_profit_pct": 0.10},
    "趋势": {"stop_loss_pct": 0.07, "take_profit_pct": 0.15},
    "突破": {"stop_loss_pct": 0.05, "take_profit_pct": 0.12},
    "均值回归": {"stop_loss_pct": 0.04, "take_profit_pct": 0.08},
}

# Mock 股票池
MOCK_STOCKS: list[dict[str, str]] = [
    {"code": "600519", "name": "贵州茅台"},
    {"code": "000858", "name": "五粮液"},
    {"code": "601318", "name": "中国平安"},
    {"code": "000001", "name": "平安银行"},
    {"code": "600036", "name": "招商银行"},
    {"code": "000333", "name": "美的集团"},
    {"code": "002415", "name": "海康威视"},
    {"code": "600276", "name": "恒瑞医药"},
    {"code": "000568", "name": "泸州老窖"},
    {"code": "002304", "name": "洋河股份"},
]


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
                sig.actual_pnl = round(random.uniform(-0.05, 0.12), 4)  # MVP: mock
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
    # MVP: 随机选择一只股票
    stock = random.choice(MOCK_STOCKS)
    signal_price = round(random.uniform(15, 200), 2)
    confidence = calc_confidence(strategy.type, factors)
    stop_loss, take_profit = calc_stop_loss_take_profit(signal_price, strategy.type)

    signal = Signal(
        stock_code=stock["code"],
        stock_name=stock["name"],
        signal_type="BUY",
        strategy_id=strategy.id,
        signal_time=datetime.utcnow(),
        signal_price=signal_price,
        mode=strategy.type,
        confidence=float(confidence),
        status="pending",
        stop_loss_price=stop_loss,
        take_profit_price=take_profit,
        alert_status="safe",
    )
    db.add(signal)
    return signal


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
        stmt = stmt.where(Signal.mode == mode)

    # 仅返回用户已订阅策略的信号
    sub_stmt = select(UserSubscription.strategy_id).where(
        UserSubscription.user_id == user_id
    )
    sub_result = await db.execute(sub_stmt)
    subscribed_ids = [row[0] for row in sub_result.all()]
    if subscribed_ids:
        stmt = stmt.where(Signal.strategy_id.in_(subscribed_ids))

    stmt = stmt.order_by(Signal.signal_time.desc())
    result = await db.execute(stmt)
    signals = result.scalars().all()

    return [_signal_to_dict(s) for s in signals]


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

    if not subscribed_ids:
        return []

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

    # Free 用户每日可见上限
    if user_plan == "free" and len(signals) > FREE_DAILY_SIGNAL_LIMIT:
        signals = signals[:FREE_DAILY_SIGNAL_LIMIT]

    return [_signal_to_dict(s) for s in signals]


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

    if not subscribed_ids:
        return {
            "today_count": 0,
            "holding": 0,
            "take_profit": 0,
            "stop_loss": 0,
            "alerting": 0,
        }

    now = datetime.utcnow()
    today = now.date()

    # 今日信号数
    today_count = await db.scalar(
        select(func.count(Signal.id)).where(
            Signal.strategy_id.in_(subscribed_ids),
            func.date(Signal.signal_time) == today,
        )
    ) or 0

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

    # 计算浮动盈亏 (MVP: mock)
    current_price = None
    floating_pnl = None
    if s.status == "executed":
        current_price = round(s.signal_price * random.uniform(0.92, 1.12), 2)
        floating_pnl = round(
            (current_price - s.signal_price) / s.signal_price * 100, 2
        )

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

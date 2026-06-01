"""因子计算引擎 — 7大因子计算 + mock 模式

因子说明：
  1. 估值优势：PE/PB 分位数越低分越高
  2. 涨势动力：均线多头排列 + MACD 金叉
  3. 资金热度：主力净流入占比 + 换手率
  4. 反弹潜力：距近60日高点回撤幅度
  5. 市场温度：全市场上涨家数占比 + 涨停家数占比
  6. 震荡程度：ATR/Close + 布林带宽度
  7. 突破强度：收盘价突破布林上轨/前高 + 成交量放大

MVP 阶段使用 mock 随机值，保留真实计算函数签名和框架。
"""

import random
import logging
from datetime import datetime

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.factor import FactorState

logger = logging.getLogger(__name__)

# 7 大因子标签
FACTOR_LABELS: list[str] = [
    "估值优势", "涨势动力", "资金热度", "反弹潜力",
    "市场温度", "震荡程度", "突破强度",
]


def clamp(value: float, min_val: float = 0.0, max_val: float = 100.0) -> float:
    """将数值限制在 [min_val, max_val] 区间"""
    return max(min_val, min(max_val, value))


# ---------- 辅助计算函数 ----------


def calc_sma(data: list[float], period: int) -> list[float | None]:
    """简单移动平均 (SMA)

    Args:
        data: 数值序列
        period: 窗口期

    Returns:
        与 data 等长的列表，前 period-1 个为 None
    """
    result: list[float | None] = []
    for i in range(len(data)):
        if i < period - 1:
            result.append(None)
        else:
            window = data[i - period + 1 : i + 1]
            result.append(round(sum(window) / period, 4))
    return result


def calc_ema(data: list[float], period: int) -> list[float | None]:
    """指数移动平均 (EMA)

    Args:
        data: 数值序列
        period: 窗口期

    Returns:
        与 data 等长的列表，前 period-1 个为 None
    """
    if not data or len(data) < period:
        return [None] * len(data)

    multiplier = 2.0 / (period + 1)
    result: list[float | None] = [None] * (period - 1)

    # 第一个 EMA 值 = 前 period 个值的 SMA
    first_ema = sum(data[:period]) / period
    result.append(round(first_ema, 4))

    ema = first_ema
    for i in range(period, len(data)):
        ema = data[i] * multiplier + ema * (1 - multiplier)
        result.append(round(ema, 4))

    return result


def calc_macd(
    closes: list[float],
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """MACD: DIF, DEA, MACD 柱

    Args:
        closes: 收盘价序列
        fast: 快线周期 (默认 12)
        slow: 慢线周期 (默认 26)
        signal: 信号线周期 (默认 9)

    Returns:
        (dif_list, dea_list, macd_hist_list)
    """
    if len(closes) < slow:
        empty = [None] * len(closes)
        return empty, empty, empty

    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)

    # DIF = EMA(fast) - EMA(slow)
    dif: list[float | None] = []
    for i in range(len(closes)):
        if ema_fast[i] is None or ema_slow[i] is None:
            dif.append(None)
        else:
            dif.append(round(ema_fast[i] - ema_slow[i], 4))  # type: ignore[arg-type]

    # DEA = EMA(DIF, signal)
    dif_valid: list[float] = [d for d in dif if d is not None]
    dea_raw = calc_ema(dif_valid, signal) if len(dif_valid) >= signal else [None] * len(dif_valid)

    # 对齐 DEA 到原始长度
    none_prefix_len = len(closes) - len(dea_raw)
    dea: list[float | None] = [None] * none_prefix_len + dea_raw

    # MACD 柱 = 2 * (DIF - DEA)
    macd_hist: list[float | None] = []
    for i in range(len(closes)):
        if dif[i] is not None and dea[i] is not None:
            macd_hist.append(round(2 * (dif[i] - dea[i]), 4))  # type: ignore[arg-type]
        else:
            macd_hist.append(None)

    return dif, dea, macd_hist


def calc_atr(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    period: int = 14,
) -> list[float | None]:
    """平均真实波幅 (ATR)

    TR = max(H-L, |H-C_prev|, |L-C_prev|)
    ATR = SMA(TR, period)

    Args:
        highs: 最高价序列
        lows: 最低价序列
        closes: 收盘价序列
        period: 窗口期 (默认 14)

    Returns:
        与输入等长的列表
    """
    if len(highs) < 2:
        return [None] * len(highs)

    # 计算 True Range
    tr_list: list[float] = []
    tr_list.append(highs[0] - lows[0])  # 第一根无前收盘
    for i in range(1, len(highs)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        tr_list.append(tr)

    # SMA
    result: list[float | None] = []
    for i in range(len(tr_list)):
        if i < period - 1:
            result.append(None)
        else:
            result.append(round(sum(tr_list[i - period + 1 : i + 1]) / period, 4))
    return result


def calc_bollinger(
    closes: list[float],
    period: int = 20,
    std_dev: int = 2,
) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """布林带: upper, middle, lower

    Args:
        closes: 收盘价序列
        period: 窗口期 (默认 20)
        std_dev: 标准差倍数 (默认 2)

    Returns:
        (upper_list, middle_list, lower_list)
    """
    import math

    upper: list[float | None] = []
    middle: list[float | None] = []
    lower: list[float | None] = []

    for i in range(len(closes)):
        if i < period - 1:
            upper.append(None)
            middle.append(None)
            lower.append(None)
        else:
            window = closes[i - period + 1 : i + 1]
            avg = sum(window) / period
            variance = sum((x - avg) ** 2 for x in window) / period
            sd = math.sqrt(variance)

            mid = round(avg, 4)
            up = round(avg + std_dev * sd, 4)
            lo = round(avg - std_dev * sd, 4)

            middle.append(mid)
            upper.append(up)
            lower.append(lo)

    return upper, middle, lower


def percentile_rank(series: list[float], value: float) -> float:
    """计算 value 在 series 中的百分位排名

    Args:
        series: 参考序列
        value: 目标值

    Returns:
        0-100 的百分位排名
    """
    if not series:
        return 50.0
    count_below = sum(1 for v in series if v < value)
    return round(count_below / len(series) * 100, 2)


# ---------- 7大因子计算 (MVP: mock 随机值) ----------


def calc_valuation(stock_code: str) -> float:
    """估值优势：PE/PB 分位数越低分越高

    真实逻辑：
      1. 获取近 250 日 PE/PB
      2. 计算当前值在 250 日中的分位数
      3. 分位数越低 → 估值越低 → 得分越高（反转）
      4. PE 权重 0.6，PB 权重 0.4
    """
    # MVP: mock 随机值
    return round(random.uniform(30, 85), 2)


def calc_momentum(stock_code: str) -> float:
    """涨势动力：均线多头排列 + MACD 金叉

    真实逻辑：
      1. MA5 > MA20 > MA60 → 多头排列
      2. MACD 金叉加分
      3. 权重: 均线 0.6 + MACD 0.4
    """
    return round(random.uniform(25, 90), 2)


def calc_capital_heat(stock_code: str) -> float:
    """资金热度：主力净流入占比 + 换手率

    真实逻辑：
      1. 主力净流入占比映射到 0-100
      2. 换手率适中偏高最佳（5-10% 满分）
      3. 权重: 净流入 0.6 + 换手率 0.4
    """
    return round(random.uniform(20, 80), 2)


def calc_rebound(stock_code: str) -> float:
    """反弹潜力：距近60日高点回撤幅度

    真实逻辑：
      1. 近 60 日最高价
      2. 回撤幅度 = (high_60 - current) / high_60
      3. 回撤越深潜力越高，0%→0分，50%→100分
    """
    return round(random.uniform(15, 75), 2)


def calc_market_temperature() -> float:
    """市场温度：全市场上涨家数占比 + 涨停家数占比

    真实逻辑：
      1. 上涨占比 → 直接映射 0-100
      2. 涨停占比 → 0%→0分，3%+→100分
      3. 权重: 上涨 0.7 + 涨停 0.3
    """
    return round(random.uniform(30, 70), 2)


def calc_volatility(stock_code: str) -> float:
    """震荡程度：ATR/Close + 布林带宽度

    真实逻辑：
      1. ATR(14)/Close → 标准化，0%→0分，8%+→100分
      2. 布林带宽度 = (Upper-Lower)/Middle → 0%→0分，15%+→100分
      3. 权重: ATR 0.6 + BB 0.4
    """
    return round(random.uniform(20, 85), 2)


def calc_breakout(stock_code: str) -> float:
    """突破强度：收盘价突破布林上轨/前高 + 成交量放大

    真实逻辑：
      1. 布林带突破得分 (突破上轨=100, 中轨上方=60, 下方=20)
      2. 前高突破得分
      3. 量比得分 (0.5→0, 3.0+→100)
      4. 权重: BB 0.35 + 前高 0.35 + 量比 0.3
    """
    return round(random.uniform(15, 90), 2)


# ---------- 状态判定 ----------


def determine_factor_status(value: float, change: float) -> str:
    """根据因子值和变化判定状态

    - danger:  value < 20 或 |change| > 10
    - warning: value < 40 或 |change| > 5
    - normal:  其他
    """
    if value < 20 or abs(change) > 10:
        return "danger"
    elif value < 40 or abs(change) > 5:
        return "warning"
    else:
        return "normal"


# ---------- 主入口 ----------


async def calculate_factors(
    strategy_id: str,
    stock_code: str | None,
    db: AsyncSession,
) -> list[dict]:
    """计算策略的7大因子并保存到数据库

    Args:
        strategy_id: 策略 ID
        stock_code: 股票代码，为 None 时使用默认 000001
        db: 异步数据库会话

    Returns:
        因子计算结果列表
    """
    if stock_code is None:
        stock_code = "000001"

    # 因子计算函数映射
    calc_functions: dict[str, callable] = {
        "估值优势": lambda: calc_valuation(stock_code),
        "涨势动力": lambda: calc_momentum(stock_code),
        "资金热度": lambda: calc_capital_heat(stock_code),
        "反弹潜力": lambda: calc_rebound(stock_code),
        "市场温度": lambda: calc_market_temperature(),
        "震荡程度": lambda: calc_volatility(stock_code),
        "突破强度": lambda: calc_breakout(stock_code),
    }

    # 获取上次因子值（用于计算 change）
    prev_factors: dict[str, float] = {}
    result = await db.execute(
        select(FactorState).where(FactorState.strategy_id == strategy_id)
    )
    for fs in result.scalars().all():
        prev_factors[fs.label] = fs.value

    # 删除该策略的旧因子记录
    await db.execute(
        delete(FactorState).where(FactorState.strategy_id == strategy_id)
    )
    await db.flush()

    # 计算新因子
    new_factors: list[dict] = []
    for label, calc_fn in calc_functions.items():
        value = calc_fn()
        prev_value = prev_factors.get(label, value)
        change = round(value - prev_value, 2)
        status = determine_factor_status(value, change)

        fs = FactorState(
            strategy_id=strategy_id,
            label=label,
            value=value,
            change=change,
            status=status,
            calculated_at=datetime.utcnow(),
        )
        db.add(fs)

        new_factors.append({
            "label": label,
            "value": value,
            "change": change,
            "status": status,
        })

    await db.commit()
    logger.info("因子计算完成 strategy_id=%s, factors=%d", strategy_id, len(new_factors))
    return new_factors

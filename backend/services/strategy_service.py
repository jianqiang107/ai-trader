"""策略服务 — 列表/详情/绩效/订阅/因子

提供策略 CRUD、绩效查询、订阅管理、因子状态获取等功能。
"""

import logging
from datetime import datetime, date

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from schemas.common import AppException
from models.strategy import Strategy, UserSubscription
from models.factor import FactorState
from middleware.auth import has_permission
from services import factor_service

logger = logging.getLogger(__name__)


async def get_strategies(
    type: str | None,
    sort: str | None,
    user_id: str,
    db: AsyncSession,
) -> list[dict]:
    """获取策略列表，含 is_subscribed 标记

    Args:
        type: 策略类型筛选 (低吸/趋势/突破/均值回归)
        sort: 排序字段 (total_return/win_rate/sharpe_ratio 等)
        user_id: 当前用户 ID
        db: 异步数据库会话

    Returns:
        策略列表
    """
    # 查询所有活跃策略
    stmt = select(Strategy).where(Strategy.is_active == True)  # noqa: E712
    if type:
        stmt = stmt.where(Strategy.type == type)

    # 排序
    sort_column = _get_sort_column(sort)
    if sort_column is not None:
        stmt = stmt.order_by(sort_column.desc())

    result = await db.execute(stmt)
    strategies = result.scalars().all()

    # 查询用户已订阅的策略 ID
    sub_stmt = select(UserSubscription.strategy_id).where(
        UserSubscription.user_id == user_id
    )
    sub_result = await db.execute(sub_stmt)
    subscribed_ids = {row[0] for row in sub_result.all()}

    # 组装输出
    output = []
    for s in strategies:
        data = _strategy_to_dict(s)
        data["is_subscribed"] = s.id in subscribed_ids
        output.append(data)

    return output


async def get_strategy_detail(
    strategy_id: str,
    user_id: str,
    db: AsyncSession,
) -> dict:
    """获取策略详情

    Args:
        strategy_id: 策略 ID
        user_id: 当前用户 ID
        db: 异步数据库会话

    Returns:
        策略详情字典

    Raises:
        AppException: 策略不存在 (2001)
    """
    stmt = select(Strategy).where(Strategy.id == strategy_id)
    result = await db.execute(stmt)
    strategy = result.scalars().first()

    if strategy is None:
        raise AppException(code=2001, message="策略不存在", data=None)

    # 检查用户是否已订阅
    sub_stmt = select(UserSubscription).where(
        UserSubscription.user_id == user_id,
        UserSubscription.strategy_id == strategy_id,
    )
    sub_result = await db.execute(sub_stmt)
    is_subscribed = sub_result.scalars().first() is not None

    data = _strategy_to_dict(strategy)
    data["is_subscribed"] = is_subscribed
    return data


async def get_factor_states(
    strategy_id: str,
    db: AsyncSession,
) -> list[dict]:
    """获取策略因子状态，如果无数据则触发一次计算

    Args:
        strategy_id: 策略 ID
        db: 异步数据库会话

    Returns:
        因子状态列表
    """
    # 查询已有因子
    stmt = select(FactorState).where(FactorState.strategy_id == strategy_id)
    result = await db.execute(stmt)
    factors = result.scalars().all()

    # 如果没有因子数据，触发一次计算
    if not factors:
        factors_data = await factor_service.calculate_factors(
            strategy_id=strategy_id,
            stock_code=None,
            db=db,
        )
        return factors_data

    # 返回已有因子
    return [
        {
            "label": f.label,
            "value": f.value,
            "change": f.change,
            "status": f.status,
        }
        for f in factors
    ]


async def get_performance(
    strategy_id: str,
    start: str,
    end: str,
    db: AsyncSession,
) -> dict:
    """获取策略绩效（MVP 返回 mock 数据）

    Args:
        strategy_id: 策略 ID
        start: 起始日期 (YYYY-MM-DD)
        end: 结束日期 (YYYY-MM-DD)
        db: 异步数据库会话

    Returns:
        绩效数据
    """
    # 验证策略存在
    stmt = select(Strategy).where(Strategy.id == strategy_id)
    result = await db.execute(stmt)
    strategy = result.scalars().first()

    if strategy is None:
        raise AppException(code=2001, message="策略不存在", data=None)

    # MVP: mock 绩效数据
    import random

    # 生成 30 天的净值曲线
    dates = []
    strategy_values = []
    benchmark_values = []
    base_strategy = 1.0
    base_benchmark = 1.0

    from datetime import timedelta
    start_date = datetime.strptime(start, "%Y-%m-%d") if start else datetime.utcnow() - timedelta(days=30)
    end_date = datetime.strptime(end, "%Y-%m-%d") if end else datetime.utcnow()

    current = start_date
    while current <= end_date:
        dates.append(current.strftime("%Y-%m-%d"))
        base_strategy *= (1 + random.uniform(-0.02, 0.03))
        base_benchmark *= (1 + random.uniform(-0.015, 0.02))
        strategy_values.append(round(base_strategy, 4))
        benchmark_values.append(round(base_benchmark, 4))
        current += timedelta(days=1)

    # 生成 mock 交易记录
    trades = []
    for i in range(min(5, len(dates) - 1)):
        trades.append({
            "date": dates[i * 6] if i * 6 < len(dates) else dates[-1],
            "action": random.choice(["BUY", "SELL"]),
            "price": round(random.uniform(10, 100), 2),
            "pnl": round(random.uniform(-0.05, 0.1), 4),
        })

    return {
        "dates": dates,
        "strategy_values": strategy_values,
        "benchmark_values": benchmark_values,
        "total_return": strategy.total_return,
        "max_drawdown": strategy.max_drawdown,
        "sharpe_ratio": strategy.sharpe_ratio,
        "trades": trades,
    }


async def subscribe_strategy(
    strategy_id: str,
    user_id: str,
    user_plan: str,
    db: AsyncSession,
) -> None:
    """订阅策略，检查权限

    Args:
        strategy_id: 策略 ID
        user_id: 当前用户 ID
        user_plan: 当前用户会员等级
        db: 异步数据库会话

    Raises:
        AppException: 策略不存在 (2001) / 权限不足 (403) / 已订阅 (2002)
    """
    # 验证策略存在
    stmt = select(Strategy).where(Strategy.id == strategy_id)
    result = await db.execute(stmt)
    strategy = result.scalars().first()

    if strategy is None:
        raise AppException(code=2001, message="策略不存在", data=None)

    # 检查权限
    if not has_permission(user_plan, strategy.required_plan):
        raise AppException(
            code=403,
            message=f"需要 {strategy.required_plan} 及以上会员",
            data=None,
        )

    # 检查是否已订阅
    sub_stmt = select(UserSubscription).where(
        UserSubscription.user_id == user_id,
        UserSubscription.strategy_id == strategy_id,
    )
    sub_result = await db.execute(sub_stmt)
    existing = sub_result.scalars().first()

    if existing is not None:
        raise AppException(code=2002, message="已订阅该策略", data=None)

    # 创建订阅
    subscription = UserSubscription(
        user_id=user_id,
        strategy_id=strategy_id,
        subscribed_at=datetime.utcnow(),
    )
    db.add(subscription)
    await db.commit()
    logger.info("用户 %s 订阅策略 %s", user_id, strategy_id)


# ---------- 内部辅助 ----------


def _get_sort_column(sort: str | None):
    """将排序参数映射到 ORM 列"""
    sort_map = {
        "total_return": Strategy.total_return,
        "win_rate": Strategy.win_rate,
        "sharpe_ratio": Strategy.sharpe_ratio,
        "max_drawdown": Strategy.max_drawdown,
        "signal_count": Strategy.signal_count,
        "running_days": Strategy.running_days,
    }
    return sort_map.get(sort) if sort else None


def _strategy_to_dict(s: Strategy) -> dict:
    """将 Strategy ORM 对象转换为字典"""
    return {
        "id": s.id,
        "name": s.name,
        "type": s.type,
        "description": s.description,
        "total_return": s.total_return,
        "win_rate": s.win_rate,
        "max_drawdown": s.max_drawdown,
        "sharpe_ratio": s.sharpe_ratio,
        "sortino_ratio": s.sortino_ratio,
        "calmar_ratio": s.calmar_ratio,
        "running_days": s.running_days,
        "signal_count": s.signal_count,
        "required_plan": s.required_plan,
        "is_active": s.is_active,
        "is_subscribed": False,
    }

"""APScheduler 定时任务定义

任务列表：
  - 收盘后批量因子计算 (15:30, 周一至周五)
  - 盘中增量因子更新 (每 5 分钟, 9:00-15:00, 周一至周五)
  - 信号过期检查 (每小时)
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from database import async_session
from services import factor_service, signal_service
from models.strategy import Strategy
from models.signal import Signal

from sqlalchemy import select

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def job_calculate_factors() -> None:
    """收盘后批量因子计算

    遍历所有活跃策略，逐一计算 7 大因子。
    """
    logger.info("[Scheduler] 收盘后批量因子计算开始")
    try:
        async with async_session() as db:
            # 查询所有活跃策略
            result = await db.execute(
                select(Strategy).where(Strategy.is_active == True)  # noqa: E712
            )
            strategies = result.scalars().all()

            for strategy in strategies:
                try:
                    await factor_service.calculate_factors(
                        strategy_id=strategy.id,
                        stock_code=None,
                        db=db,
                    )
                except Exception as e:
                    logger.error(
                        "因子计算失败 strategy_id=%s: %s", strategy.id, e
                    )

            # 因子计算完成后，触发信号评估
            try:
                await signal_service.evaluate_and_generate_signals(db)
            except Exception as e:
                logger.error("信号评估失败: %s", e)

        logger.info("[Scheduler] 收盘后批量因子计算完成, 策略数=%d", len(strategies))
    except Exception as e:
        logger.error("[Scheduler] 批量因子计算任务异常: %s", e)


async def job_incremental_factor_update() -> None:
    """盘中增量因子更新

    交易时段内，每 5 分钟增量更新因子值。
    MVP: 与批量计算逻辑相同（全量重算）。
    """
    logger.info("[Scheduler] 盘中增量因子更新开始")
    try:
        async with async_session() as db:
            result = await db.execute(
                select(Strategy).where(Strategy.is_active == True)  # noqa: E712
            )
            strategies = result.scalars().all()

            for strategy in strategies:
                try:
                    await factor_service.calculate_factors(
                        strategy_id=strategy.id,
                        stock_code=None,
                        db=db,
                    )
                except Exception as e:
                    logger.error(
                        "增量因子计算失败 strategy_id=%s: %s", strategy.id, e
                    )

            # 增量更新后也触发信号评估
            try:
                await signal_service.evaluate_and_generate_signals(db)
            except Exception as e:
                logger.error("增量信号评估失败: %s", e)

        logger.info("[Scheduler] 盘中增量因子更新完成, 策略数=%d", len(strategies))
    except Exception as e:
        logger.error("[Scheduler] 增量因子更新任务异常: %s", e)


async def job_expire_signals() -> None:
    """信号过期检查

    将超过 24h 的 pending 信号标记为 expired。
    """
    logger.info("[Scheduler] 信号过期检查开始")
    try:
        async with async_session() as db:
            count = await signal_service.expire_signals(db)
            if count > 0:
                logger.info("[Scheduler] 已过期 %d 条信号", count)
    except Exception as e:
        logger.error("[Scheduler] 信号过期检查异常: %s", e)


def setup_scheduler() -> AsyncIOScheduler:
    """注册定时任务并返回调度器实例

    Returns:
        已注册任务的 AsyncIOScheduler 实例
    """
    # 收盘后批量因子计算 (15:30, 周一至周五)
    scheduler.add_job(
        job_calculate_factors,
        "cron",
        hour=15,
        minute=30,
        day_of_week="mon-fri",
        id="job_calculate_factors",
        replace_existing=True,
    )

    # 盘中增量因子更新 (每5分钟, 9:00-15:00, 周一至周五)
    scheduler.add_job(
        job_incremental_factor_update,
        "cron",
        minute="*/5",
        hour="9-15",
        day_of_week="mon-fri",
        id="job_incremental_factor_update",
        replace_existing=True,
    )

    # 信号过期检查 (每小时)
    scheduler.add_job(
        job_expire_signals,
        "cron",
        minute=0,
        id="job_expire_signals",
        replace_existing=True,
    )

    logger.info("[Scheduler] 定时任务注册完成 (3 个任务)")
    return scheduler

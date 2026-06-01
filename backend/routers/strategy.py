"""策略路由 — 列表/详情/绩效/订阅/因子

5 个端点，全部需要 JWT 认证：
  - GET  /strategies           策略列表
  - GET  /strategies/:id       策略详情
  - GET  /strategies/:id/performance  策略绩效
  - POST /strategies/:id/subscribe    订阅策略
  - GET  /strategies/:id/factors      因子状态
"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.common import ApiResponse
from schemas.strategy import StrategyOut, FactorStateOut, PerformanceOut
from services import strategy_service
from middleware.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/strategies", tags=["策略"])


@router.get("")
async def list_strategies(
    type: str | None = Query(None, description="策略类型筛选"),
    sort: str | None = Query(None, description="排序字段"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取策略列表，含 is_subscribed 标记"""
    strategies = await strategy_service.get_strategies(
        type=type,
        sort=sort,
        user_id=user.id,
        db=db,
    )
    return ApiResponse(data=strategies)


@router.get("/{strategy_id}")
async def get_strategy(
    strategy_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取策略详情"""
    detail = await strategy_service.get_strategy_detail(
        strategy_id=strategy_id,
        user_id=user.id,
        db=db,
    )
    return ApiResponse(data=detail)


@router.get("/{strategy_id}/performance")
async def get_performance(
    strategy_id: str,
    start: str | None = Query(None, description="起始日期 YYYY-MM-DD"),
    end: str | None = Query(None, description="结束日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取策略绩效"""
    # 默认近 30 天
    if start is None:
        from datetime import timedelta
        start = (date.today() - timedelta(days=30)).strftime("%Y-%m-%d")
    if end is None:
        end = date.today().strftime("%Y-%m-%d")

    performance = await strategy_service.get_performance(
        strategy_id=strategy_id,
        start=start,
        end=end,
        db=db,
    )
    return ApiResponse(data=performance)


@router.post("/{strategy_id}/subscribe")
async def subscribe_strategy(
    strategy_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """订阅策略"""
    await strategy_service.subscribe_strategy(
        strategy_id=strategy_id,
        user_id=user.id,
        user_plan=user.plan,
        db=db,
    )
    return ApiResponse(data=None, message="订阅成功")


@router.get("/{strategy_id}/factors")
async def get_factors(
    strategy_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取策略因子状态，如果无数据则触发一次计算"""
    factors = await strategy_service.get_factor_states(
        strategy_id=strategy_id,
        db=db,
    )
    return ApiResponse(data=factors)

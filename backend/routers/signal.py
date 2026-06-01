"""信号路由 — 择时/情绪/实盘信号/操作

8 个端点，全部需要 JWT 认证：
  - GET  /signals/timing         择时信号
  - GET  /signals/emotion1       市场情绪1 (恐惧贪婪)
  - GET  /signals/emotion2       市场情绪2 (资金流向)
  - GET  /signals/live           实盘信号列表
  - GET  /signals/live/stats     实盘信号统计
  - POST /signals/:id/execute    执行信号
  - POST /signals/:id/ignore     忽略信号
  - PUT  /signals/:id/alert      设置止损止盈预警
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.common import ApiResponse
from schemas.signal import AlertSettingIn
from services import signal_service
from middleware.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/signals", tags=["信号"])


@router.get("/timing")
async def get_timing_signals(
    date: str | None = Query(None, description="日期 YYYY-MM-DD"),
    mode: str | None = Query(None, description="策略模式"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取择时信号"""
    signals = await signal_service.get_timing_signals(
        date=date,
        mode=mode,
        user_id=user.id,
        db=db,
    )
    return ApiResponse(data=signals)


@router.get("/emotion1")
async def get_emotion1(
    date: str | None = Query(None, description="日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取市场情绪数据1 — 恐惧贪婪指数"""
    data = await signal_service.get_emotion1_data(date_str=date)
    return ApiResponse(data=data)


@router.get("/emotion2")
async def get_emotion2(
    date: str | None = Query(None, description="日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取市场情绪数据2 — 资金流向"""
    data = await signal_service.get_emotion2_data(date_str=date)
    return ApiResponse(data=data)


@router.get("/live")
async def get_live_signals(
    type: str | None = Query(None, description="信号类型: BUY/SELL"),
    period: str | None = Query("today", description="时间周期: today/week/month"),
    search: str | None = Query(None, description="股票代码/名称搜索"),
    onlyHolding: bool = Query(False, description="仅显示持仓中"),
    onlyAlerting: bool = Query(False, description="仅显示预警中"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取实盘信号列表"""
    filter_data = {
        "type": type,
        "period": period,
        "search": search,
        "onlyHolding": onlyHolding,
        "onlyAlerting": onlyAlerting,
    }
    signals = await signal_service.get_live_signals(
        filter_data=filter_data,
        user_id=user.id,
        user_plan=user.plan,
        db=db,
    )
    return ApiResponse(data=signals)


@router.get("/live/stats")
async def get_live_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取实盘信号统计"""
    stats = await signal_service.get_live_stats(
        user_id=user.id,
        db=db,
    )
    return ApiResponse(data=stats)


@router.post("/{signal_id}/execute")
async def execute_signal(
    signal_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """执行信号 (pending → executed)"""
    await signal_service.execute_signal(
        signal_id=signal_id,
        user_id=user.id,
        db=db,
    )
    return ApiResponse(data=None, message="信号已执行")


@router.post("/{signal_id}/ignore")
async def ignore_signal(
    signal_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """忽略信号 (pending → ignored)"""
    await signal_service.ignore_signal(
        signal_id=signal_id,
        user_id=user.id,
        db=db,
    )
    return ApiResponse(data=None, message="信号已忽略")


@router.put("/{signal_id}/alert")
async def set_alert(
    signal_id: str,
    body: AlertSettingIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """设置止损止盈预警"""
    setting = body.model_dump(exclude_none=True)
    await signal_service.set_alert(
        signal_id=signal_id,
        setting=setting,
        user_id=user.id,
        db=db,
    )
    return ApiResponse(data=None, message="预警设置已更新")

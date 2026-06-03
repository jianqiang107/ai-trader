"""自选股路由 — 添加 / 删除 / 列表 (MVP mock)"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from schemas.common import ApiResponse
from middleware.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/watchlist", tags=["自选股"])


class AddWatchlistRequest(BaseModel):
    """添加自选股请求体"""
    code: str


@router.get("")
async def get_watchlist(user: User = Depends(get_current_user)):
    """获取自选股列表 (MVP mock)"""
    return ApiResponse(data=[])


@router.post("")
async def add_watchlist(
    body: AddWatchlistRequest,
    user: User = Depends(get_current_user),
):
    """添加自选股 (MVP mock)"""
    return ApiResponse(data=None, message="添加成功")


@router.delete("/{code}")
async def remove_watchlist(
    code: str,
    user: User = Depends(get_current_user),
):
    """删除自选股 (MVP mock)"""
    return ApiResponse(data=None, message="删除成功")

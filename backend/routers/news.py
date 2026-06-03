"""资讯路由 — 新闻列表 / 详情 (MVP mock)"""

from fastapi import APIRouter

from schemas.common import ApiResponse

router = APIRouter(prefix="/news", tags=["资讯"])


@router.get("")
async def get_news_list():
    """获取资讯列表 (MVP mock)"""
    return ApiResponse(data=[])


@router.get("/bottom")
async def get_news_bottom():
    """获取底部资讯 (MVP mock)"""
    return ApiResponse(data=[])


@router.get("/{news_id}")
async def get_news_detail(news_id: str):
    """获取资讯详情 (MVP mock)"""
    return ApiResponse(code=404, data=None, message="资讯不存在")

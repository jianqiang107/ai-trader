"""资讯路由 - 新闻列表 / 详情 (MVP mock)"""

from fastapi import APIRouter, Query

from schemas.common import ApiResponse

router = APIRouter(prefix="/news", tags=["资讯"])

NEWS_ITEMS = [
    {
        "id": "news-001",
        "title": "AI精选：高股息与银行板块延续资金流入，低波动策略占优",
        "summary": "银行、保险等高股息资产继续获得防御资金关注，适合低吸和均值回归策略优先观察。",
        "content": "今日盘面中高股息资产保持相对强势，资金偏好仍集中在低估值和稳定现金流方向。短线追高性价比一般，更适合等待回撤后的纪律化低吸。",
        "source": "AI交易大师",
        "published_at": "2026-06-03T09:35:00",
        "sentiment": "利好",
        "impact_score": 86,
        "related_stocks": ["601318", "600036", "601939"],
        "related_sectors": ["S08"],
        "category": "ai_picked",
    },
    {
        "id": "news-002",
        "title": "市场快讯：半导体板块早盘放量，突破类信号数量增加",
        "summary": "电子、半导体方向出现成交放大，需关注突破后的量能延续和回踩确认。",
        "content": "半导体方向早盘成交额明显放大，多只个股进入突破观察区。若午后量能不能延续，突破失败风险会抬升。",
        "source": "东方财富",
        "published_at": "2026-06-03T10:12:00",
        "sentiment": "利好",
        "impact_score": 78,
        "related_stocks": ["002415", "000725", "002230"],
        "related_sectors": ["S02", "S11"],
        "category": "market",
    },
    {
        "id": "news-003",
        "title": "个股资讯：新能源汽车链回暖，比亚迪相关情绪升温",
        "summary": "汽车与新能源链条出现情绪修复，趋势策略可关注回踩后的二次确认。",
        "content": "新能源汽车产业链盘中活跃，整车和零部件方向均有资金回流。当前更适合观察趋势延续，不宜在快速拉升后盲目追入。",
        "source": "财联社",
        "published_at": "2026-06-03T10:40:00",
        "sentiment": "中性",
        "impact_score": 72,
        "related_stocks": ["002594", "002475"],
        "related_sectors": ["S04", "S09"],
        "category": "stock",
    },
    {
        "id": "news-004",
        "title": "政策解读：科技创新政策延续，计算机与AI应用方向受关注",
        "summary": "政策面继续强调科技创新，短线情绪偏积极，但需结合业绩兑现度筛选。",
        "content": "科技创新相关政策保持连续性，计算机、AI应用和高端制造方向有望受益。策略上应优先选择资金热度和突破强度同步改善的个股。",
        "source": "证券时报",
        "published_at": "2026-06-03T11:05:00",
        "sentiment": "利好",
        "impact_score": 82,
        "related_stocks": ["002230"],
        "related_sectors": ["S03", "S11"],
        "category": "policy",
    },
    {
        "id": "news-005",
        "title": "风险提示：部分高位题材股波动加剧，短线追涨需控制仓位",
        "summary": "高位题材成交放大但分歧增强，突破失败后的回撤速度可能加快。",
        "content": "高位题材股盘中波动放大，部分个股出现冲高回落。对已触发预警的持仓，应优先确认止损止盈线是否合理。",
        "source": "AI交易大师",
        "published_at": "2026-06-03T11:20:00",
        "sentiment": "利空",
        "impact_score": 69,
        "related_stocks": ["600160", "605020"],
        "related_sectors": ["S01"],
        "category": "ai_picked",
    },
]


@router.get("")
async def get_news_list(
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
):
    """获取资讯列表 (MVP mock)"""
    items = NEWS_ITEMS
    if category and category != "all":
        items = [item for item in items if item["category"] == category]

    start = (page - 1) * size
    return ApiResponse(data=items[start:start + size])


@router.get("/bottom")
async def get_news_bottom():
    """获取底部资讯 (MVP mock)"""
    return ApiResponse(data=NEWS_ITEMS[:4])


@router.get("/{news_id}")
async def get_news_detail(news_id: str):
    """获取资讯详情 (MVP mock)"""
    for item in NEWS_ITEMS:
        if item["id"] == news_id:
            return ApiResponse(data=item)
    return ApiResponse(code=404, data=None, message="资讯不存在")

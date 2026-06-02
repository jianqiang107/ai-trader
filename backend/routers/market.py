"""行情数据 API 路由

端点列表:
  GET /api/market/indices       - 大盘指数
  GET /api/market/diagnose      - 诊断 akshare 状态（仅开发/调试用）
  GET /api/market/kline         - K线数据 (?code=600519.SH&period=daily)
  GET /api/market/fenshi        - 分时数据 (?code=600519.SH)
  GET /api/market/volfs         - 量能数据 (?code=600519.SH) [mock fallback]
  GET /api/market/quote         - 个股实时报价 (?code=600519.SH)
  GET /api/market/stocks        - 个股列表 (?page=1&pageSize=50&sortBy=change_pct&sortOrder=desc)
  GET /api/market/sectors       - 板块列表 (?type=concept)
  GET /api/market/fundflow      - 资金流向 (?code=600519.SH)
  GET /api/market/northflow     - 北向资金
"""
import math
import random
import traceback
from fastapi import APIRouter, Query
from services import akshare_service as svc

router = APIRouter()


# ---------- 大盘指数 ----------

@router.get("/indices")
def get_indices():
    """获取实时大盘指数（上证/深证/创业板/科创50/沪深300）"""
    data = svc.get_indices()
    return {"code": 0, "data": data, "message": "ok"}


# ---------- AKShare 诊断（调试端点）----------

@router.get("/diagnose")
def diagnose_akshare():
    """诊断 akshare 是否可用，排查行情数据为空的原因"""
    result = {"akshare_importable": False, "akshare_version": None,
              "test_call_ok": False, "test_data_rows": 0,
              "error": None, "traceback": None}
    try:
        import akshare as ak
        result["akshare_importable"] = True
        result["akshare_version"] = getattr(ak, "__version__", "unknown")
    except Exception as e:
        result["error"] = f"import akshare failed: {e}"
        result["traceback"] = traceback.format_exc()
        return result

    try:
        df = ak.stock_zh_index_spot_em(symbol="沪深重要指数")
        result["test_call_ok"] = True
        result["test_data_rows"] = len(df) if df is not None else 0
        if df is not None and not df.empty:
            result["columns"] = list(df.columns)
            result["sample"] = df.head(2).to_dict("records")
    except Exception as e:
        result["error"] = f"API call failed: {e}"
        result["traceback"] = traceback.format_exc()

    return result


# ---------- K线数据 ----------

@router.get("/kline")
def get_kline(
    code: str = Query(..., description="股票代码，如 600519.SH"),
    period: str = Query("daily", description="周期: daily | weekly | monthly"),
):
    """获取个股/指数 K线数据"""
    if period not in ("daily", "weekly", "monthly"):
        period = "daily"
    data = svc.get_kline(code, period)
    return {"code": 0, "data": data, "message": "ok"}


# ---------- 分时数据 ----------

@router.get("/fenshi")
def get_fenshi(
    code: str = Query(..., description="股票代码，如 600519.SH"),
):
    """获取当日分时数据"""
    data = svc.get_fenshi(code)
    return {"code": 0, "data": data, "message": "ok"}


# ---------- 量能数据 ----------

@router.get("/volfs")
def get_volfs(
    code: str = Query(..., description="股票代码，如 600519.SH"),
):
    """获取量能数据（暂用算法生成，后续接入真实数据源）"""
    data = []
    for i in range(240):
        vol = math.floor(random.random() * 8000 + 500)
        data.append({
            "date": str(i),
            "vol_value": vol,
            "vol_signal": "bullish" if vol > 5000 else "neutral" if vol > 2000 else "bearish",
        })
    return {"code": 0, "data": data, "message": "ok"}


# ---------- 个股实时报价 ----------

@router.get("/quote")
def get_stock_quote(
    code: str = Query(..., description="股票代码，如 600519.SH"),
):
    """获取个股实时报价"""
    data = svc.get_stock_quote(code)
    if not data:
        return {"code": 404, "data": None, "message": f"未找到 {code} 的数据"}
    return {"code": 0, "data": data, "message": "ok"}


# ---------- 个股列表 ----------

@router.get("/stocks")
def get_stock_list(
    page: int = Query(1, ge=1, description="页码"),
    pageSize: int = Query(50, ge=1, le=200, description="每页条数"),
    sortBy: str = Query("change_pct", description="排序字段"),
    sortOrder: str = Query("desc", description="asc / desc"),
):
    """获取个股列表（分页+排序）"""
    data = svc.get_stock_list(page, pageSize, sortBy, sortOrder)
    return {"code": 0, "data": data, "message": "ok"}


# ---------- 板块列表 ----------

@router.get("/sectors")
def get_sectors(
    type: str = Query("concept", description="板块类型: concept | industry"),
):
    """获取板块列表"""
    data = svc.get_sectors(type)
    return {"code": 0, "data": data, "message": "ok"}


# ---------- 资金流向 ----------

@router.get("/fundflow")
def get_fund_flow(
    code: str = Query(..., description="股票代码，如 600519.SH"),
):
    """获取个股资金流向"""
    data = svc.get_fund_flow(code)
    if not data:
        return {"code": 404, "data": None, "message": f"未找到 {code} 的资金流向数据"}
    return {"code": 0, "data": data, "message": "ok"}


# ---------- 北向资金 ----------

@router.get("/northflow")
def get_north_flow():
    """获取北向资金净流入"""
    data = svc.get_north_flow()
    if not data:
        return {"code": 404, "data": None, "message": "暂无北向资金数据"}
    return {"code": 0, "data": data, "message": "ok"}

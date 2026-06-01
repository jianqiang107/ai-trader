"""AKShare 行情数据服务封装

数据源：东方财富（push2his.eastmoney.com）
所有函数返回 JSON-serializable 的 Python 结构
字段命名：snake_case，与前端 TypeScript 类型对齐

部署注意：需在沙箱外运行（云服务器/Docker），沙箱环境限制金融 API 访问
"""
import akshare as ak
import pandas as pd
from datetime import timedelta, date
from services.cache_service import cache


# ---------- 指数数据 ----------

# 关注的指数（东方财富代码, 名称）
INDEX_MAP = {
    "000001.SH": ("1.000001", "上证指数"),
    "399001.SZ": ("0.399001", "深证成指"),
    "399006.SZ": ("0.399006", "创业板指"),
    "000688.SH": ("1.000688", "科创50"),
    "000300.SH": ("1.000300", "沪深300"),
}


def _fmt_index(row: pd.Series, code: str = "", name: str = "") -> dict:
    """格式化指数行数据 → 前端 IndexData 类型"""
    return {
        "code": code or str(row.get("代码", "")),
        "name": name or str(row.get("名称", "")),
        "price": float(row.get("最新价", 0) or 0),
        "change_pct": float(row.get("涨跌幅", 0) or 0),
        "change_amount": float(row.get("涨跌额", 0) or 0),
    }


def get_indices() -> list[dict]:
    """获取实时大盘指数"""
    cached = cache.get("indices")
    if cached:
        return cached

    try:
        df = ak.stock_zh_index_spot_em()
        result = []

        for wind_code, (em_code, name_zh) in INDEX_MAP.items():
            short_code = em_code.split(".")[1]
            # 优先用代码匹配
            match = df[df["代码"].astype(str).str.contains(short_code)] if "代码" in df.columns else pd.DataFrame()
            if not match.empty:
                result.append(_fmt_index(match.iloc[0], code=wind_code, name=name_zh))
            else:
                # fallback: 名称匹配
                name_short = name_zh.replace("指数", "").replace("指", "")
                match = df[df["名称"].str.contains(name_short)] if "名称" in df.columns else pd.DataFrame()
                if not match.empty:
                    result.append(_fmt_index(match.iloc[0], code=wind_code, name=name_zh))

        cache.set("indices", result, ttl=60)  # 指数缓存 1 分钟
        return result
    except Exception as e:
        print(f"[AKShare] get_indices failed: {e}")
        return []


# ---------- K线数据 ----------

def get_kline(code: str, period: str = "daily") -> list[dict]:
    """获取个股/指数 K线数据

    Args:
        code: 股票代码，如 '000001.SH', '600519.SH'
        period: daily | weekly | monthly
    """
    cache_key = f"kline:{code}:{period}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        symbol = code.split(".")[0]
        end = date.today().strftime("%Y%m%d")
        start = (date.today() - timedelta(days=200)).strftime("%Y%m%d")

        df = ak.stock_zh_a_hist(
            symbol=symbol,
            period=period,
            start_date=start,
            end_date=end,
            adjust="qfq",  # 前复权
        )

        if df is None or df.empty:
            return []

        result = []
        for _, row in df.iterrows():
            result.append({
                "stock_code": code,
                "date": str(row.get("日期", "")),
                "open": float(row.get("开盘", 0) or 0),
                "close": float(row.get("收盘", 0) or 0),
                "high": float(row.get("最高", 0) or 0),
                "low": float(row.get("最低", 0) or 0),
                "volume": float(row.get("成交量", 0) or 0),
                "amount": float(row.get("成交额", 0) or 0),
                "change_pct": float(row.get("涨跌幅", 0) or 0),
                "turnover_rate": float(row.get("换手率", 0) or 0),
            })

        # 计算 MA5, MA10, MA20, MA30
        closes = [r["close"] for r in result]
        for i, r in enumerate(result):
            r["ma5"] = round(sum(closes[i - 4: i + 1]) / 5, 2) if i >= 4 else None
            r["ma10"] = round(sum(closes[i - 9: i + 1]) / 10, 2) if i >= 9 else None
            r["ma20"] = round(sum(closes[i - 19: i + 1]) / 20, 2) if i >= 19 else None
            r["ma30"] = round(sum(closes[i - 29: i + 1]) / 30, 2) if i >= 29 else None

        cache.set(cache_key, result, ttl=300)  # K线缓存 5 分钟
        return result
    except Exception as e:
        print(f"[AKShare] get_kline({code}, {period}) failed: {e}")
        return []


# ---------- 分时数据 ----------

def get_fenshi(code: str) -> list[dict]:
    """获取当日分时数据"""
    cache_key = f"fenshi:{code}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        symbol = code.split(".")[0]
        df = ak.stock_zh_a_minute(symbol=symbol, period="1")

        if df is None or df.empty:
            return []

        result = []
        for _, row in df.iterrows():
            result.append({
                "time": str(row.get("时间", "")),
                "price": float(row.get("成交价", 0) or 0),
                "avg_price": float(row.get("均价", 0) or 0),
                "volume": float(row.get("成交量", 0) or 0),
            })

        cache.set(cache_key, result, ttl=60)
        return result
    except Exception as e:
        print(f"[AKShare] get_fenshi({code}) failed: {e}")
        return []


# ---------- 板块数据 ----------

def get_sectors(sector_type: str = "concept") -> list[dict]:
    """获取板块列表"""
    cache_key = f"sectors:{sector_type}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        if sector_type == "industry":
            df = ak.stock_board_industry_name_em()
        else:
            df = ak.stock_board_concept_name_em()

        if df is None or df.empty:
            return []

        result = []
        for _, row in df.iterrows():
            result.append({
                "name": str(row.get("板块名称", "")),
                "code": str(row.get("板块代码", "")),
                "change_pct": float(row.get("涨跌幅", 0) or 0),
                "up_count": int(row.get("上涨家数", 0) or 0),
                "down_count": int(row.get("下跌家数", 0) or 0),
                "turnover_rate": float(row.get("换手率", 0) or 0),
                "lead_stock": str(row.get("领涨股票", "")),
            })

        result.sort(key=lambda x: x["change_pct"], reverse=True)
        cache.set(cache_key, result, ttl=120)
        return result
    except Exception as e:
        print(f"[AKShare] get_sectors({sector_type}) failed: {e}")
        return []


# ---------- 资金流向 ----------

def get_fund_flow(code: str) -> dict:
    """获取个股资金流向"""
    cache_key = f"fundflow:{code}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        symbol = code.split(".")[0]
        market = "sh" if code.endswith(".SH") else "sz"
        df = ak.stock_individual_fund_flow(stock=symbol, market=market)

        if df is None or df.empty:
            return {}

        latest = df.iloc[0]
        result = {
            "date": str(latest.get("日期", "")),
            "main_net_inflow": float(latest.get("主力净流入", 0) or 0),
            "main_net_inflow_pct": float(latest.get("主力净流入占比", 0) or 0),
            "super_large_net_inflow": float(latest.get("超大单净流入", 0) or 0),
            "large_net_inflow": float(latest.get("大单净流入", 0) or 0),
            "medium_net_inflow": float(latest.get("中单净流入", 0) or 0),
            "small_net_inflow": float(latest.get("小单净流入", 0) or 0),
        }

        cache.set(cache_key, result, ttl=120)
        return result
    except Exception as e:
        print(f"[AKShare] get_fund_flow({code}) failed: {e}")
        return {}


# ---------- 个股实时报价 ----------

def get_stock_quote(code: str) -> dict:
    """获取个股实时报价"""
    cache_key = f"quote:{code}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        symbol = code.split(".")[0]
        df = ak.stock_zh_a_spot_em()

        match = df[df["代码"].astype(str) == symbol]
        if match.empty:
            return {}

        row = match.iloc[0]
        result = {
            "code": code,
            "name": str(row.get("名称", "")),
            "price": float(row.get("最新价", 0) or 0),
            "open": float(row.get("今开", 0) or 0),
            "high": float(row.get("最高", 0) or 0),
            "low": float(row.get("最低", 0) or 0),
            "pre_close": float(row.get("昨收", 0) or 0),
            "change_amount": float(row.get("涨跌额", 0) or 0),
            "change_pct": float(row.get("涨跌幅", 0) or 0),
            "volume": float(row.get("成交量", 0) or 0),
            "amount": float(row.get("成交额", 0) or 0),
            "turnover_rate": float(row.get("换手率", 0) or 0),
            "pe": float(row.get("市盈率-动态", 0) or 0),
            "pb": float(row.get("市净率", 0) or 0),
            "total_mv": float(row.get("总市值", 0) or 0),
            "circ_mv": float(row.get("流通市值", 0) or 0),
        }

        cache.set(cache_key, result, ttl=30)
        return result
    except Exception as e:
        print(f"[AKShare] get_stock_quote({code}) failed: {e}")
        return {}


def get_stock_list(page: int = 1, page_size: int = 50, sort_by: str = "change_pct",
                   sort_order: str = "desc") -> dict:
    """获取个股列表（分页+排序）"""
    cache_key = f"stocks:p{page}:s{page_size}:{sort_by}:{sort_order}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        df = ak.stock_zh_a_spot_em()
        if df is None or df.empty:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}

        rows = []
        for _, row in df.iterrows():
            code_raw = str(row.get("代码", ""))
            rows.append({
                "code": f"{code_raw}.{_guess_market(code_raw)}",
                "name": str(row.get("名称", "")),
                "price": float(row.get("最新价", 0) or 0),
                "change_pct": float(row.get("涨跌幅", 0) or 0),
                "change_amount": float(row.get("涨跌额", 0) or 0),
                "volume": float(row.get("成交量", 0) or 0),
                "amount": float(row.get("成交额", 0) or 0),
                "turnover_rate": float(row.get("换手率", 0) or 0),
                "pe": float(row.get("市盈率-动态", 0) or 0),
                "pb": float(row.get("市净率", 0) or 0),
                "total_mv": float(row.get("总市值", 0) or 0),
            })

        # 排序
        if rows and sort_by in rows[0]:
            reverse = sort_order == "desc"
            rows.sort(key=lambda x: x.get(sort_by, 0) or 0, reverse=reverse)

        # 分页
        total = len(rows)
        start = (page - 1) * page_size
        items = rows[start:start + page_size]

        result = {"items": items, "total": total, "page": page, "page_size": page_size}
        cache.set(cache_key, result, ttl=60)
        return result
    except Exception as e:
        print(f"[AKShare] get_stock_list failed: {e}")
        return {"items": [], "total": 0, "page": page, "page_size": page_size}


def _guess_market(code: str) -> str:
    """根据代码猜测市场后缀"""
    if not code:
        return "SZ"
    if code.startswith(("6", "9", "5")):
        return "SH"
    return "SZ"


# ---------- 北向资金 ----------

def get_north_flow() -> dict:
    """获取北向资金净流入（沪股通+深股通）"""
    cache_key = "northflow"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        df = ak.stock_hsgt_north_net_flow_in_em(symbol="北向")
        if df is None or df.empty:
            return {}

        latest = df.iloc[-1]
        result = {
            "date": str(latest.get("日期", "")),
            "net_inflow": float(latest.get("当日净流入", 0) or 0),
            "balance": float(latest.get("当日余额", 0) or 0),
        }

        # 最近 5 日趋势
        recent = df.tail(5)
        trend = []
        for _, row in recent.iterrows():
            trend.append({
                "date": str(row.get("日期", "")),
                "net_inflow": float(row.get("当日净流入", 0) or 0),
            })
        result["trend"] = trend

        cache.set(cache_key, result, ttl=300)
        return result
    except Exception as e:
        print(f"[AKShare] get_north_flow failed: {e}")
        return {}

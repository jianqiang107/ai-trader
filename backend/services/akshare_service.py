"""AKShare 行情数据服务封装

数据源：东方财富（push2his.eastmoney.com）
所有函数返回 JSON-serializable 的 Python 结构
字段命名：snake_case，与前端 TypeScript 类型对齐

部署注意：需在沙箱外运行（云服务器/Docker），沙箱环境限制金融 API 访问
"""
from __future__ import annotations  # 所有类型注解懒加载，避免运行时 import

import random
import traceback
from datetime import timedelta, date
from services.cache_service import cache

# pandas 懒加载
_pd = None
def _get_pd():
    global _pd
    if _pd is None:
        import pandas as pd_mod
        _pd = pd_mod
    return _pd

# akshare 懒加载：仅在调用数据 API 时才导入
# 避免顶层 import 在 Render 等平台上因依赖缺失炸掉整个应用启动
_ak = None
_ak_import_error: Exception | None = None


def _get_ak():
    """懒加载 akshare，首次调用时导入，失败时抛出原始错误"""
    global _ak, _ak_import_error
    if _ak is not None:
        return _ak
    if _ak_import_error is not None:
        raise RuntimeError(f"akshare 导入失败: {_ak_import_error}") from _ak_import_error
    try:
        import akshare as ak_mod
        _ak = ak_mod
        return _ak
    except Exception as e:
        _ak_import_error = e
        raise RuntimeError(f"akshare 导入失败: {e}") from e


# ---------- 指数数据 ----------

# 需要的 5 个核心指数：短代码 → 名称
TARGET_INDICES = {
    "000001": "上证指数",
    "399001": "深证成指",
    "399006": "创业板指",
    "000688": "科创50",
    "000300": "沪深300",
}


def _fmt_index(row, code: str = "", name: str = "") -> dict:
    """格式化指数行数据 → 前端 IndexData 类型（含完整行情字段）"""
    pd = _get_pd()
    return {
        "code": code or str(row.get("代码", "")),
        "name": name or str(row.get("名称", "")),
        "price": float(row.get("最新价", 0) or 0),
        "change_pct": float(row.get("涨跌幅", 0) or 0),
        "change_amount": float(row.get("涨跌额", 0) or 0),
        "open": float(row.get("今开", 0) or 0),
        "high": float(row.get("最高", 0) or 0),
        "low": float(row.get("最低", 0) or 0),
        "pre_close": float(row.get("昨收", 0) or 0),
        "volume": float(row.get("成交量", 0) or 0),
        "amount": float(row.get("成交额", 0) or 0),
        "amplitude": float(row.get("振幅", 0) or 0),
        "volume_ratio": float(row.get("量比", 0) or 0),
    }


def _mock_indices() -> list[dict]:
    """行情 API 不可用时的 fallback 模拟数据（数值接近真实盘面水平）"""
    base_data = [
        {"code": "000001.SH", "name": "上证指数", "price": 3285.65, "change_pct": 0.42},
        {"code": "399001.SZ", "name": "深证成指", "price": 9876.32, "change_pct": 0.68},
        {"code": "399006.SZ", "name": "创业板指", "price": 1923.14, "change_pct": 1.05},
        {"code": "000688.SH", "name": "科创50",   "price": 1052.88, "change_pct": -0.33},
        {"code": "000300.SH", "name": "沪深300",  "price": 3891.22, "change_pct": 0.55},
    ]
    result = []
    for d in base_data:
        price = d["price"]
        change_pct = d["change_pct"]
        pre_close = round(price / (1 + change_pct / 100), 2)
        change_amount = round(price - pre_close, 2)
        result.append({
            "code": d["code"],
            "name": d["name"],
            "price": price,
            "change_pct": change_pct,
            "change_amount": change_amount,
            "open": round(pre_close * (1 + random.uniform(-0.003, 0.005)), 2),
            "high": round(price * random.uniform(1.002, 1.015), 2),
            "low": round(price * random.uniform(0.985, 0.998), 2),
            "pre_close": pre_close,
            "volume": round(random.uniform(2e9, 5e9)),
            "amount": round(random.uniform(2e11, 5e11)),
            "amplitude": round(random.uniform(0.8, 2.5), 2),
            "volume_ratio": round(random.uniform(0.7, 1.5), 2),
        })
    return result


def get_indices() -> list[dict]:
    """获取实时大盘指数（上证/深证/创业板/科创50/沪深300）

    数据源: stock_zh_index_spot_em (东方财富)
    - symbol="沪深重要指数" → 上证/深证/创业板/沪深300
    - symbol="上证系列指数" → 科创50
    fallback: akshare 不可用时返回模拟数据（前端仍可渲染）
    """
    cached = cache.get("indices")
    if cached:
        return cached

    try:
        pd = _get_pd()
        # 两次调用覆盖全部 5 个目标指数
        df_main = _get_ak().stock_zh_index_spot_em(symbol="沪深重要指数")
        df_sh = _get_ak().stock_zh_index_spot_em(symbol="上证系列指数")

        # 合并去重（以代码为准）
        all_df = pd.concat([df_main, df_sh]).drop_duplicates(subset=["代码"])

        result = []
        for short_code, name_zh in TARGET_INDICES.items():
            match = all_df[all_df["代码"].astype(str) == short_code]
            if not match.empty:
                wind_code = f"{short_code}.{_guess_market(short_code)}"
                result.append(_fmt_index(match.iloc[0], code=wind_code, name=name_zh))

        if result:
            cache.set("indices", result, ttl=60)  # 指数缓存 1 分钟
            return result

        # akshare 返回了数据但没匹配到目标指数，也用 fallback
        print("[AKShare] get_indices: no matching indices found, using fallback")
        return _mock_indices()

    except Exception as e:
        print(f"[AKShare] get_indices failed: {e}")
        print(traceback.format_exc())
        return _mock_indices()


# ---------- K线数据 ----------

def _mock_kline(code: str, days: int = 120) -> list[dict]:
    """K线 fallback 模拟数据（随机游走，带 MA）"""
    today = date.today()
    result = []
    price = 50.0
    for i in range(days, -1, -1):
        d = today - timedelta(days=i)
        if d.weekday() >= 5:  # 跳过周末
            continue
        change = random.uniform(-0.03, 0.03)
        open_ = round(price * (1 + random.uniform(-0.01, 0.01)), 2)
        close = round(price * (1 + change), 2)
        high = round(max(open_, close) * random.uniform(1.001, 1.02), 2)
        low = round(min(open_, close) * random.uniform(0.98, 0.999), 2)
        result.append({
            "stock_code": code,
            "date": d.strftime("%Y-%m-%d"),
            "open": open_,
            "close": close,
            "high": high,
            "low": low,
            "volume": round(random.uniform(5e6, 5e7)),
            "amount": round(random.uniform(5e8, 5e9)),
            "change_pct": round(change * 100, 2),
            "turnover_rate": round(random.uniform(0.5, 5.0), 2),
        })
        price = close
    # 补充 MA 均线
    closes = [r["close"] for r in result]
    for i, r in enumerate(result):
        r["ma5"] = round(sum(closes[i - 4: i + 1]) / 5, 2) if i >= 4 else None
        r["ma10"] = round(sum(closes[i - 9: i + 1]) / 10, 2) if i >= 9 else None
        r["ma20"] = round(sum(closes[i - 19: i + 1]) / 20, 2) if i >= 19 else None
        r["ma30"] = round(sum(closes[i - 29: i + 1]) / 30, 2) if i >= 29 else None
    return result


def _mock_fenshi(code: str) -> list[dict]:
    """分时数据 fallback"""
    result = []
    price = random.uniform(10, 100)
    for minute in range(240):
        h = 9 + minute // 60
        m = 30 + minute % 60
        if m >= 60:
            h += 1
            m -= 60
        price = round(price * (1 + random.uniform(-0.002, 0.002)), 2)
        result.append({
            "time": f"{h:02d}:{m:02d}",
            "price": price,
            "avg_price": round(price * random.uniform(0.998, 1.002), 2),
            "volume": round(random.uniform(1e5, 1e6)),
        })
    return result


def _mock_stock_list(page: int = 1, page_size: int = 50) -> dict:
    """个股列表 fallback"""
    stocks = [
        ("600519", "贵州茅台", "SH"), ("000858", "五粮液", "SZ"), ("300750", "宁德时代", "SZ"),
        ("601318", "中国平安", "SH"), ("600036", "招商银行", "SH"), ("000001", "平安银行", "SZ"),
        ("600276", "恒瑞医药", "SH"), ("300059", "东方财富", "SZ"), ("601166", "兴业银行", "SH"),
        ("600900", "长江电力", "SH"), ("000333", "美的集团", "SZ"), ("601888", "中国中免", "SH"),
        ("300015", "爱尔眼科", "SZ"), ("002415", "海康威视", "SZ"), ("600309", "万华化学", "SH"),
    ]
    items = []
    for code, name, mkt in stocks:
        price = round(random.uniform(5, 500), 2)
        change_pct = round(random.uniform(-5, 5), 2)
        items.append({
            "code": f"{code}.{mkt}",
            "name": name,
            "price": price,
            "change_pct": change_pct,
            "change_amount": round(price * change_pct / 100, 2),
            "volume": round(random.uniform(1e7, 1e9)),
            "amount": round(random.uniform(1e9, 1e11)),
            "turnover_rate": round(random.uniform(0.5, 8.0), 2),
            "pe": round(random.uniform(10, 60), 1),
            "pb": round(random.uniform(1, 10), 2),
            "total_mv": round(random.uniform(1e10, 1e13)),
        })
    total = len(items)
    start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "total": total, "page": page, "page_size": page_size}


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

        df = _get_ak().stock_zh_a_hist(
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
        print(traceback.format_exc())
        return _mock_kline(code)


# ---------- 分时数据 ----------

def get_fenshi(code: str) -> list[dict]:
    """获取当日分时数据"""
    cache_key = f"fenshi:{code}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        symbol = code.split(".")[0]
        df = _get_ak().stock_zh_a_minute(symbol=symbol, period="1")

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
        return _mock_fenshi(code)


# ---------- 板块数据 ----------

def get_sectors(sector_type: str = "concept") -> list[dict]:
    """获取板块列表"""
    cache_key = f"sectors:{sector_type}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        if sector_type == "industry":
            df = _get_ak().stock_board_industry_name_em()
        else:
            df = _get_ak().stock_board_concept_name_em()

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
        df = _get_ak().stock_individual_fund_flow(stock=symbol, market=market)

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
        df = _get_ak().stock_zh_a_spot_em()

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
        # fallback: 返回模拟报价
        price = round(random.uniform(10, 200), 2)
        change_pct = round(random.uniform(-5, 5), 2)
        pre_close = round(price / (1 + change_pct / 100), 2)
        return {
            "code": code,
            "name": code.split(".")[0],
            "price": price,
            "open": round(pre_close * random.uniform(0.99, 1.01), 2),
            "high": round(price * random.uniform(1.01, 1.05), 2),
            "low": round(price * random.uniform(0.95, 0.99), 2),
            "pre_close": pre_close,
            "change_amount": round(price - pre_close, 2),
            "change_pct": change_pct,
            "volume": round(random.uniform(1e7, 1e9)),
            "amount": round(random.uniform(1e9, 1e11)),
            "turnover_rate": round(random.uniform(0.5, 8.0), 2),
            "pe": round(random.uniform(10, 60), 1),
            "pb": round(random.uniform(1, 10), 2),
            "total_mv": round(random.uniform(1e10, 1e12)),
            "circ_mv": round(random.uniform(5e9, 5e11)),
        }


def get_stock_list(page: int = 1, page_size: int = 50, sort_by: str = "change_pct",
                   sort_order: str = "desc") -> dict:
    """获取个股列表（分页+排序）"""
    cache_key = f"stocks:p{page}:s{page_size}:{sort_by}:{sort_order}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        df = _get_ak().stock_zh_a_spot_em()
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
        return _mock_stock_list(page, page_size)


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
        df = _get_ak().stock_hsgt_north_net_flow_in_em(symbol="北向")
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

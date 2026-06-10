"""行情数据服务封装

数据源：东方财富 API（直接调用，不依赖 AKShare 网络层）
所有函数返回 JSON-serializable 的 Python 结构
字段命名：snake_case，与前端 TypeScript 类型对齐
"""
from __future__ import annotations

import json
import logging
import random
import time
import traceback
from datetime import date, datetime, timedelta
from services.cache_service import cache

logger = logging.getLogger(__name__)

# ---------- 东方财富 API Session ----------

_EM_SESSION = None
_LAST_SOURCE: dict[str, str] = {}
_CACHE_SOURCE: dict[str, str] = {}


def _set_last_source(key: str, source: str) -> None:
    _LAST_SOURCE[key] = source


def get_last_source(key: str) -> str:
    return _LAST_SOURCE.get(key, "unknown")


def _remember_cache_source(cache_key: str, source: str) -> None:
    _CACHE_SOURCE[cache_key] = source


def _restore_cache_source(source_key: str, cache_key: str) -> None:
    source = _CACHE_SOURCE.get(cache_key, "cache")
    _set_last_source(source_key, f"cache:{source}" if source != "cache" else "cache")

def _em_session():
    """返回全局复用的 requests.Session，配置东方财富所需的 Headers"""
    global _EM_SESSION
    if _EM_SESSION is None:
        import requests
        s = requests.Session()
        s.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://quote.eastmoney.com/",
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
        })
        _EM_SESSION = s
    return _EM_SESSION


def _em_get(url: str, params: dict = None, timeout: int = 10, retries: int = 1) -> dict:
    """调用东方财富 API，返回 JSON dict
    timeout: 超时秒数 (默认10s)
    retries: 重试次数 (默认1次)
    """
    last_err = None
    for attempt in range(retries + 1):
        try:
            r = _em_session().get(url, params=params, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(0.5)
    raise last_err


# ---------- 字段映射 ----------

# 东方财富 clist/get 字段 → 前端字段名
_FIELD_MAP_SPOT = {
    "f2": "price",       # 最新价
    "f3": "change_pct",  # 涨跌幅
    "f4": "change_amount",  # 涨跌额
    "f5": "volume",      # 成交量
    "f6": "amount",      # 成交额
    "f7": "amplitude",   # 振幅
    "f8": "turnover_rate",  # 换手率
    "f9": "pe",          # 市盈率-动态
    "f10": "volume_ratio",  # 量比
    "f12": "code",       # 代码
    "f14": "name",       # 名称
    "f15": "high",       # 最高
    "f16": "low",        # 最低
    "f17": "open",       # 今开
    "f18": "pre_close",  # 昨收
    "f20": "total_mv",   # 总市值
    "f21": "circ_mv",    # 流通市值
    "f23": "pb",         # 市净率
    "f115": "pe_static", # 市盈率-静态
}

def _parse_spot_item(item: dict, code_suffix: str = "") -> dict:
    """将东方财富 API 单条记录转为前端格式"""
    result = {}
    for fkey, fname in _FIELD_MAP_SPOT.items():
        val = item.get(fkey, "")
        if val == "-" or val == "" or val is None:
            result[fname] = None if fname in ("code", "name") else 0.0
        elif fname in ("code", "name"):
            result[fname] = str(val)
        else:
            result[fname] = float(val)
    if code_suffix:
        result["code"] = f"{result['code']}.{code_suffix}"
    return result


def _to_market_code(code: str) -> str:
    """600519.SH → 1.600519  /  000001.SZ → 0.000001"""
    symbol = code.split(".")[0] if "." in code else code
    if symbol.startswith(("6", "9", "5")):
        return f"1.{symbol}"
    return f"0.{symbol}"


def _guess_market(code: str) -> str:
    if not code:
        return "SZ"
    if code.startswith(("6", "9", "5")):
        return "SH"
    return "SZ"


def _with_stock_ui_fields(stock: dict) -> dict:
    """补齐前端股票列表展示需要的派生字段。"""
    code = str(stock.get("code") or "")
    symbol = code.split(".")[0] if "." in code else code
    market = code.split(".")[-1] if "." in code else _guess_market(code)
    change_pct = float(stock.get("change_pct") or 0)
    turnover_rate = float(stock.get("turnover_rate") or 0)
    score = max(0, min(100, round(50 + change_pct * 5 + turnover_rate * 2)))

    signal_tags = []
    if score >= 70 and change_pct < 1:
        signal_tags.append("低吸")
    if change_pct >= 1:
        signal_tags.append("趋势")
    if change_pct >= 3 or turnover_rate >= 5:
        signal_tags.append("突破")
    if not signal_tags and 45 <= score <= 65:
        signal_tags.append("均值回归")

    stock["market"] = market
    stock["timing_score"] = score
    stock["signal_tags"] = signal_tags
    stock["sector_names"] = STOCK_SECTOR_MAP.get(symbol, [])
    stock["sector_codes"] = stock.get("sector_codes") or []
    return stock


# ---------- 核心 API URL ----------

EM_CLIST_URL = "https://82.push2.eastmoney.com/api/qt/clist/get"
EM_KLINE_URL = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
EM_TRENDS_URL = "https://push2.eastmoney.com/api/qt/stock/trends2/get"
EM_STOCK_URL = "https://push2.eastmoney.com/api/qt/stock/get"
TENCENT_QUOTE_URL = "https://qt.gtimg.cn/q="

STOCK_SECTOR_MAP: dict[str, list[str]] = {
    "600246": ["存储芯片", "房地产服务"],
    "600482": ["船舶", "军工"],
    "603268": ["船舶", "外贸"],
    "000725": ["存储芯片", "面板"],
    "000063": ["通信设备", "算力"],
    "002230": ["AI应用", "算力"],
    "600745": ["半导体", "算力"],
    "300274": ["储能", "光伏"],
    "300750": ["储能", "新能源车"],
    "600438": ["光伏", "储能"],
    "002594": ["新能源车", "储能"],
    "601899": ["有色金属", "黄金"],
    "600570": ["金融科技", "软件"],
    "002475": ["消费电子", "AI终端"],
}


STOCK_UNIVERSE: list[tuple[str, str]] = [
    ("600246", "SH"), ("600482", "SH"), ("603268", "SH"),
    ("600519", "SH"), ("000858", "SZ"), ("300750", "SZ"), ("601318", "SH"),
    ("600036", "SH"), ("000001", "SZ"), ("600276", "SH"), ("300059", "SZ"),
    ("601166", "SH"), ("600900", "SH"), ("000333", "SZ"), ("601888", "SH"),
    ("300015", "SZ"), ("002415", "SZ"), ("600309", "SH"), ("000002", "SZ"),
    ("600030", "SH"), ("002714", "SZ"), ("300124", "SZ"), ("601012", "SH"),
    ("600809", "SH"), ("002475", "SZ"), ("300274", "SZ"), ("600585", "SH"),
    ("000651", "SZ"), ("603259", "SH"), ("002304", "SZ"), ("300760", "SZ"),
    ("600887", "SH"), ("000725", "SZ"), ("601899", "SH"), ("002594", "SZ"),
    ("300498", "SZ"), ("600050", "SH"), ("000063", "SZ"), ("601088", "SH"),
    ("002142", "SZ"), ("600048", "SH"), ("300122", "SZ"), ("601398", "SH"),
    ("000568", "SZ"), ("600570", "SH"), ("002230", "SZ"), ("600438", "SH"),
    ("300033", "SZ"), ("601668", "SH"), ("000596", "SZ"), ("600745", "SH"),
    ("002027", "SZ"), ("300413", "SZ"),
]


def _annotate_sector_strength(items: list[dict]) -> list[dict]:
    """根据当前股票池聚合板块热度，补充板块强度字段。"""
    sector_stats: dict[str, dict[str, float]] = {}
    for item in items:
        change_pct = float(item.get("change_pct") or 0)
        for sector in item.get("sector_names") or []:
            stats = sector_stats.setdefault(
                sector,
                {"count": 0, "change_sum": 0.0, "strong_count": 0, "limit_up_count": 0},
            )
            stats["count"] += 1
            stats["change_sum"] += change_pct
            if change_pct >= 5:
                stats["strong_count"] += 1
            if change_pct >= 9.7:
                stats["limit_up_count"] += 1

    sector_scores: dict[str, float] = {}
    for sector, stats in sector_stats.items():
        count = max(stats["count"], 1)
        avg_change = stats["change_sum"] / count
        score = 50 + avg_change * 8 + stats["strong_count"] * 6 + stats["limit_up_count"] * 12
        sector_scores[sector] = max(0, min(100, round(score, 2)))

    for item in items:
        sectors = item.get("sector_names") or []
        best_sector = max(sectors, key=lambda s: sector_scores.get(s, 0), default="")
        item["sector_name"] = best_sector
        item["sector_heat"] = sector_scores.get(best_sector, 0)
        item["sector_strength_label"] = "板块强度"
    return items


def _to_tencent_symbol(code: str) -> str:
    symbol = code.split(".")[0] if "." in code else code
    market = code.split(".")[1].upper() if "." in code else _guess_market(symbol)
    prefix = "sh" if market == "SH" else "sz"
    return f"{prefix}{symbol}"


def _parse_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_tencent_quote(record: str) -> dict | None:
    """解析腾讯行情 v_sh600519=\"...\" 格式。"""
    if "=\"" not in record:
        return None
    symbol_part, payload = record.split("=\"", 1)
    payload = payload.strip().rstrip("\";")
    parts = payload.split("~")
    if len(parts) < 45:
        return None

    raw_symbol = symbol_part.replace("v_", "")
    symbol = parts[2] or raw_symbol[-6:]
    market = "SH" if raw_symbol.startswith("sh") else "SZ"
    price = _parse_float(parts[3])
    pre_close = _parse_float(parts[4])
    change_amount = _parse_float(parts[31]) if len(parts) > 31 else round(price - pre_close, 2)
    change_pct = _parse_float(parts[32]) if len(parts) > 32 else 0.0
    amount_wan = _parse_float(parts[37]) if len(parts) > 37 else 0.0
    total_mv_yi = _parse_float(parts[44]) if len(parts) > 44 else 0.0
    circ_mv_yi = _parse_float(parts[45]) if len(parts) > 45 else 0.0

    quote = {
        "code": f"{symbol}.{market}",
        "name": parts[1],
        "price": price,
        "open": _parse_float(parts[5]),
        "high": _parse_float(parts[33]) if len(parts) > 33 else 0.0,
        "low": _parse_float(parts[34]) if len(parts) > 34 else 0.0,
        "pre_close": pre_close,
        "change_amount": change_amount,
        "change_pct": change_pct,
        "volume": _parse_float(parts[36]) if len(parts) > 36 else _parse_float(parts[6]),
        "amount": round(amount_wan * 10000, 2),
        "turnover_rate": _parse_float(parts[38]) if len(parts) > 38 else 0.0,
        "pe": _parse_float(parts[39]) if len(parts) > 39 else 0.0,
        "pb": _parse_float(parts[46]) if len(parts) > 46 else 0.0,
        "amplitude": _parse_float(parts[43]) if len(parts) > 43 else 0.0,
        "total_mv": round(total_mv_yi * 100000000, 2),
        "circ_mv": round(circ_mv_yi * 100000000, 2),
    }
    _with_stock_ui_fields(quote)
    return quote


def _get_tencent_quotes(codes: list[str]) -> list[dict]:
    symbols = ",".join(_to_tencent_symbol(code) for code in codes)
    if not symbols:
        return []
    req_url = TENCENT_QUOTE_URL + symbols
    import requests
    response = requests.get(
        req_url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://gu.qq.com/",
        },
        timeout=8,
    )
    response.raise_for_status()
    text = response.content.decode("gbk", errors="ignore")
    result = []
    for record in text.strip().splitlines():
        quote = _parse_tencent_quote(record)
        if quote and quote.get("price"):
            result.append(quote)
    return result


# ---------- 指数数据 ----------

TARGET_INDICES = {
    "000001": "上证指数",
    "399001": "深证成指",
    "399006": "创业板指",
    "000688": "科创50",
    "000300": "沪深300",
}

# 东方财富 clist/get API 中指数的 fs 参数
# fs=m:1+s:2,m:0+t:6,m:0+t:80  → 上证+深证重要指数
# fs=b:MK0010  → 上证系列指数（含科创50）
INDEX_FS_CODES = "m:1+s:2,m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,b:MK0010"

def _mock_indices() -> list[dict]:
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
    """获取实时大盘指数"""
    cached = cache.get("indices")
    if cached:
        _set_last_source("indices", "cache")
        return cached

    try:
        params = {
            "pn": "1", "pz": "50", "po": "1", "np": "1",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": "2", "invt": "2", "fid": "f3",
            "fs": INDEX_FS_CODES,
            "fields": "f2,f3,f4,f5,f6,f7,f8,f10,f12,f14,f15,f16,f17,f18,f20,f115",
        }
        data = _em_get(EM_CLIST_URL, params)
        items = data.get("data", {}).get("diff", [])

        result = []
        for item in items:
            code = str(item.get("f12", ""))
            if code in TARGET_INDICES:
                parsed = _parse_spot_item(item, _guess_market(code))
                parsed["name"] = TARGET_INDICES[code]
                result.append(parsed)

        if result:
            cache.set("indices", result, ttl=60)
            _set_last_source("indices", "real")
            return result

        print("[EM] get_indices: no matching indices found, using fallback")
        _set_last_source("indices", "fallback")
        return _mock_indices()

    except Exception as e:
        print(f"[EM] get_indices failed: {e}")
        traceback.print_exc()
        _set_last_source("indices", "fallback")
        return _mock_indices()


# ---------- K线数据 ----------

def _mock_kline(code: str, days: int = 120) -> list[dict]:
    today = date.today()
    result = []
    price = 50.0
    for i in range(days, -1, -1):
        d = today - timedelta(days=i)
        if d.weekday() >= 5:
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
    closes = [r["close"] for r in result]
    for i, r in enumerate(result):
        r["ma5"] = round(sum(closes[i - 4: i + 1]) / 5, 2) if i >= 4 else None
        r["ma10"] = round(sum(closes[i - 9: i + 1]) / 10, 2) if i >= 9 else None
        r["ma20"] = round(sum(closes[i - 19: i + 1]) / 20, 2) if i >= 19 else None
        r["ma30"] = round(sum(closes[i - 29: i + 1]) / 30, 2) if i >= 29 else None
    return result


_PERIOD_MAP = {"daily": "101", "weekly": "102", "monthly": "103"}


def get_kline(code: str, period: str = "daily") -> list[dict]:
    """获取个股/指数 K线数据"""
    cache_key = f"kline:{code}:{period}"
    cached = cache.get(cache_key)
    if cached:
        _set_last_source("kline", "cache")
        return cached

    try:
        secid = _to_market_code(code)
        klt = _PERIOD_MAP.get(period, "101")
        end = date.today().strftime("%Y%m%d")
        start = (date.today() - timedelta(days=200)).strftime("%Y%m%d")

        params = {
            "fields1": "f1,f2,f3,f4,f5,f6",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116",
            "secid": secid,
            "klt": klt,
            "fqt": "1",  # 前复权
            "beg": start,
            "end": end,
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        }
        data = _em_get(EM_KLINE_URL, params, timeout=5, retries=1)
        klines = data.get("data", {}).get("klines", [])

        if not klines:
            return []

        result = []
        for line in klines:
            parts = line.split(",")
            if len(parts) >= 11:
                result.append({
                    "stock_code": code,
                    "date": parts[0],
                    "open": float(parts[1]),
                    "close": float(parts[2]),
                    "high": float(parts[3]),
                    "low": float(parts[4]),
                    "volume": float(parts[5]),
                    "amount": float(parts[6]),
                    "change_pct": float(parts[8]) if parts[8] != "-" else 0.0,
                    "turnover_rate": float(parts[10]) if parts[10] != "-" else 0.0,
                })

        # 计算 MA
        closes = [r["close"] for r in result]
        for i, r in enumerate(result):
            r["ma5"] = round(sum(closes[i - 4: i + 1]) / 5, 2) if i >= 4 else None
            r["ma10"] = round(sum(closes[i - 9: i + 1]) / 10, 2) if i >= 9 else None
            r["ma20"] = round(sum(closes[i - 19: i + 1]) / 20, 2) if i >= 19 else None
            r["ma30"] = round(sum(closes[i - 29: i + 1]) / 30, 2) if i >= 29 else None

        cache.set(cache_key, result, ttl=300)
        _set_last_source("kline", "real")
        return result
    except Exception as e:
        print(f"[EM] get_kline({code}, {period}) failed: {e}")
        traceback.print_exc()
        _set_last_source("kline", "fallback")
        return _mock_kline(code)


# ---------- 分时数据 ----------

def _mock_fenshi(code: str) -> list[dict]:
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


def get_fenshi(code: str) -> list[dict]:
    """获取当日分时数据"""
    cache_key = f"fenshi:{code}"
    cached = cache.get(cache_key)
    if cached:
        _set_last_source("fenshi", "cache")
        return cached

    try:
        secid = _to_market_code(code)
        params = {
            "fields1": "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58",
            "secid": secid,
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        }
        data = _em_get(EM_TRENDS_URL, params, timeout=8, retries=1)
        trends = data.get("data", {}).get("trends", [])

        if not trends:
            return []

        result = []
        for line in trends:
            parts = line.split(",")
            if len(parts) >= 8:
                result.append({
                    "time": parts[0],
                    "price": float(parts[2]),
                    "avg_price": float(parts[7]),
                    "volume": float(parts[5]),
                })

        cache.set(cache_key, result, ttl=60)
        _set_last_source("fenshi", "real")
        return result
    except Exception as e:
        print(f"[EM] get_fenshi({code}) failed: {e}")
        _set_last_source("fenshi", "fallback")
        return _mock_fenshi(code)


# ---------- 个股列表 ----------

def _mock_stock_list(page: int = 1, page_size: int = 50) -> dict:
    stocks = [
        ("600519", "贵州茅台", "SH"), ("000858", "五粮液", "SZ"), ("300750", "宁德时代", "SZ"),
        ("601318", "中国平安", "SH"), ("600036", "招商银行", "SH"), ("000001", "平安银行", "SZ"),
        ("600276", "恒瑞医药", "SH"), ("300059", "东方财富", "SZ"), ("601166", "兴业银行", "SH"),
        ("600900", "长江电力", "SH"), ("000333", "美的集团", "SZ"), ("601888", "中国中免", "SH"),
        ("300015", "爱尔眼科", "SZ"), ("002415", "海康威视", "SZ"), ("600309", "万华化学", "SH"),
        ("000002", "万科A", "SZ"), ("600030", "中信证券", "SH"), ("002714", "牧原股份", "SZ"),
        ("300124", "汇川技术", "SZ"), ("601012", "隆基绿能", "SH"), ("600809", "山西汾酒", "SH"),
        ("002475", "立讯精密", "SZ"), ("300274", "阳光电源", "SZ"), ("600585", "海螺水泥", "SH"),
        ("000651", "格力电器", "SZ"), ("603259", "药明康德", "SH"), ("002304", "洋河股份", "SZ"),
        ("300760", "迈瑞医疗", "SZ"), ("600887", "伊利股份", "SH"), ("000725", "京东方A", "SZ"),
        ("601899", "紫金矿业", "SH"), ("002594", "比亚迪", "SZ"), ("300498", "温氏股份", "SZ"),
        ("600050", "中国联通", "SH"), ("000063", "中兴通讯", "SZ"), ("601088", "中国神华", "SH"),
        ("002142", "宁波银行", "SZ"), ("600048", "保利发展", "SH"), ("300122", "智飞生物", "SZ"),
        ("601398", "工商银行", "SH"), ("000568", "泸州老窖", "SZ"), ("600570", "恒生电子", "SH"),
        ("002230", "科大讯飞", "SZ"), ("600438", "通威股份", "SH"), ("300033", "同花顺", "SZ"),
        ("601668", "中国建筑", "SH"), ("000596", "古井贡酒", "SZ"), ("600745", "闻泰科技", "SH"),
        ("002027", "分众传媒", "SZ"), ("300413", "芒果超媒", "SZ"),
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
        _with_stock_ui_fields(items[-1])
    total = len(items)
    start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "total": total, "page": page, "page_size": page_size}

# 全市场 A 股 fs 参数: 沪深A股 + 科创板 + 北交所
ALL_STOCK_FS = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"

# clist/get 需要的完整字段列表（get_stock_list 使用）
SPOT_FIELDS = "f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23,f115"


def get_full_market_stock_list(force_refresh: bool = False) -> dict:
    """获取推荐引擎使用的全市场实时行情，不使用固定池或模拟数据回退。"""
    cache_key = "recommendation:full-market"
    if not force_refresh:
        cached = cache.get(cache_key)
        if cached:
            return cached

    params = {
        "pn": "1",
        "pz": "6000",
        "po": "1",
        "np": "1",
        "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        "fltt": "2",
        "invt": "2",
        "fid": "f6",
        "fs": ALL_STOCK_FS,
        "fields": SPOT_FIELDS,
    }

    try:
        data = _em_get(EM_CLIST_URL, params, timeout=15, retries=1)
        raw_items = data.get("data", {}).get("diff", [])
        items = []
        for raw in raw_items:
            code = str(raw.get("f12", ""))
            if not code:
                continue
            parsed = _parse_spot_item(raw, _guess_market(code))
            _with_stock_ui_fields(parsed)
            items.append(parsed)
        _annotate_sector_strength(items)
        result = {
            "items": items,
            "total": len(items),
            "source": "eastmoney",
            "quote_updated_at": datetime.now().isoformat(),
        }
        cache.set(cache_key, result, ttl=45)
        return result
    except Exception as exc:
        logger.warning("full-market quote load failed: %s", exc)
        return {
            "items": [],
            "total": 0,
            "source": "unavailable",
            "quote_updated_at": datetime.now().isoformat(),
        }


def get_stock_list(page: int = 1, page_size: int = 50, sort_by: str = "change_pct",
                   sort_order: str = "desc") -> dict:
    """获取个股列表（分页+排序）"""
    cache_key = f"stocks:p{page}:s{page_size}:{sort_by}:{sort_order}"
    cached = cache.get(cache_key)
    if cached:
        _restore_cache_source("stocks", cache_key)
        return cached

    try:
        universe_codes = [f"{code}.{market}" for code, market in STOCK_UNIVERSE]
        items = _get_tencent_quotes(universe_codes)
        if items:
            _annotate_sector_strength(items)
            reverse = sort_order != "asc"
            items.sort(key=lambda x: float(x.get(sort_by) or 0), reverse=reverse)
            total = len(items)
            start = (page - 1) * page_size
            result = {"items": items[start:start + page_size], "total": total, "page": page, "page_size": page_size}
            cache.set(cache_key, result, ttl=30)
            _remember_cache_source(cache_key, "tencent")
            _set_last_source("stocks", "tencent")
            return result
    except Exception as e:
        print(f"[Tencent] get_stock_list failed: {e}")

    try:
        # 排序字段映射到东方财富的 fid
        sort_fid_map = {
            "change_pct": "f3",
            "price": "f2",
            "volume": "f5",
            "amount": "f6",
            "turnover_rate": "f8",
        }
        fid = sort_fid_map.get(sort_by, "f3")
        po = "0" if sort_order == "asc" else "1"

        params = {
            "pn": str(page),
            "pz": str(page_size),
            "po": po,
            "np": "1",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": "2",
            "invt": "2",
            "fid": fid,
            "fs": ALL_STOCK_FS,
            "fields": SPOT_FIELDS,
        }
        data = _em_get(EM_CLIST_URL, params, timeout=10, retries=1)
        items_raw = data.get("data", {}).get("diff", [])
        total = data.get("data", {}).get("total", 0)

        items = []
        for item in items_raw:
            code = str(item.get("f12", ""))
            parsed = _parse_spot_item(item, _guess_market(code))
            _with_stock_ui_fields(parsed)
            items.append(parsed)
        _annotate_sector_strength(items)

        result = {"items": items, "total": total, "page": page, "page_size": page_size}
        cache.set(cache_key, result, ttl=60)
        _remember_cache_source(cache_key, "real")
        _set_last_source("stocks", "real")
        return result
    except Exception as e:
        print(f"[EM] get_stock_list failed: {e}")
        traceback.print_exc()
        _set_last_source("stocks", "fallback")
        return _mock_stock_list(page, page_size)


# ---------- 个股实时报价 ----------

# 个股 API 字段 → 前端字段，含缩放因子（东方财富以 0.01 为单位的字段需 /100）
_QT_FIELD_MAP = {
    "f43": ("price", 100),          # 最新价（分 → 元）
    "f44": ("high", 100),           # 最高
    "f45": ("low", 100),            # 最低
    "f46": ("open", 100),           # 今开
    "f47": ("volume", 1),           # 成交量（手）
    "f48": ("amount", 1),           # 成交额（元）
    "f50": ("volume_ratio", 100),   # 量比
    "f57": ("code", 1),             # 代码
    "f58": ("name", 1),             # 名称
    "f60": ("pre_close", 100),      # 昨收
    "f116": ("total_mv", 1),        # 总市值（元）
    "f117": ("circ_mv", 1),         # 流通市值（元）
    "f162": ("pe", 100),            # 市盈率-动态
    "f167": ("pb", 100),            # 市净率
    "f168": ("turnover_rate", 100), # 换手率
    "f169": ("change_amount", 100), # 涨跌额
    "f170": ("change_pct", 100),    # 涨跌幅
    "f171": ("amplitude", 100),     # 振幅
}

_QT_FIELDS = ",".join(_QT_FIELD_MAP.keys())


def get_stock_quote(code: str) -> dict:
    """获取个股实时报价（直接查询个股 API，精准高效）"""
    cache_key = f"quote:{code}"
    cached = cache.get(cache_key)
    if cached:
        _restore_cache_source("quote", cache_key)
        return cached

    try:
        quotes = _get_tencent_quotes([code])
        if quotes:
            result = quotes[0]
            cache.set(cache_key, result, ttl=15)
            _remember_cache_source(cache_key, "tencent")
            _set_last_source("quote", "tencent")
            return result
    except Exception as e:
        print(f"[Tencent] get_stock_quote({code}) failed: {e}")

    try:
        secid = _to_market_code(code)
        data = _em_get(EM_STOCK_URL, {
            "secid": secid,
            "fields": _QT_FIELDS,
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        })
        raw = data.get("data", {})
        if not raw or not raw.get("f57"):
            return {}

        symbol = str(raw.get("f57", ""))
        result = {}
        for fkey, (fname, divisor) in _QT_FIELD_MAP.items():
            val = raw.get(fkey)
            if val is None or val == "-":
                result[fname] = None if fname in ("code", "name") else 0.0
            elif fname in ("code", "name"):
                result[fname] = str(val)
            else:
                result[fname] = round(float(val) / divisor, 2)

        result["code"] = f"{symbol}.{_guess_market(symbol)}"
        cache.set(cache_key, result, ttl=30)
        _remember_cache_source(cache_key, "real")
        _set_last_source("quote", "real")
        return result
    except Exception as e:
        print(f"[EM] get_stock_quote({code}) failed: {e}")
        traceback.print_exc()
        _set_last_source("quote", "fallback")
        # fallback mock
        price = round(random.uniform(10, 200), 2)
        change_pct = round(random.uniform(-5, 5), 2)
        pre_close = round(price / (1 + change_pct / 100), 2)
        return {
            "code": code,
            "name": code.split(".")[0] if "." in code else code,
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


# ---------- 板块数据 ----------

def get_sectors(sector_type: str = "concept") -> list[dict]:
    """获取板块列表"""
    cache_key = f"sectors:{sector_type}"
    cached = cache.get(cache_key)
    if cached:
        _set_last_source("sectors", "cache")
        return cached

    try:
        # 东方财富板块分类
        if sector_type == "industry":
            fs_code = "m:90+t:2"
        else:
            fs_code = "m:90+t:3"

        params = {
            "pn": "1", "pz": "50", "po": "1", "np": "1",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": "2", "invt": "2", "fid": "f3",
            "fs": fs_code,
            "fields": "f2,f3,f4,f8,f12,f14,f104,f105,f128",
        }
        data = _em_get(EM_CLIST_URL, params, timeout=8, retries=1)
        items = data.get("data", {}).get("diff", [])

        result = []
        for item in items:
            result.append({
                "name": str(item.get("f14", "")),
                "code": str(item.get("f12", "")),
                "change_pct": float(item.get("f3", 0) or 0),
                "up_count": int(item.get("f104", 0) or 0),
                "down_count": int(item.get("f105", 0) or 0),
                "turnover_rate": float(item.get("f8", 0) or 0),
                "lead_stock": str(item.get("f128", "")),
            })

        result.sort(key=lambda x: x["change_pct"], reverse=True)
        cache.set(cache_key, result, ttl=120)
        _set_last_source("sectors", "real")
        return result
    except Exception as e:
        print(f"[EM] get_sectors({sector_type}) failed: {e}")
        _set_last_source("sectors", "fallback")
        return _mock_sectors()


def _mock_sectors() -> list[dict]:
    """模拟板块数据"""
    sectors = [
        ("半导体", "BK1036"), ("人工智能", "BK1057"), ("新能源车", "BK0900"),
        ("光伏", "BK1078"), ("锂电池", "BK0933"), ("白酒", "BK0477"),
        ("医疗器械", "BK0819"), ("Chiplet", "BK1164"), ("数字经济", "BK1159"),
        ("东数西算", "BK1148"), ("信创", "BK1105"), ("机器人", "BK1210"),
        ("集成电路", "BK9812"), ("消费电子", "BK1072"), ("创新药", "BK0846"),
        ("军工", "BK0595"), ("信息安全", "BK0705"), ("元宇宙", "BK1131"),
        ("算力", "BK1168"), ("液冷服务器", "BK1238"), ("数据要素", "BK1189"),
        ("华为概念", "BK2222"), ("智能汽车", "BK3333"), ("6G", "BK4444"),
        ("储能", "BK1090"), ("氢能源", "BK1112"), ("5G", "BK0704"),
        ("物联网", "BK0711"), ("国产软件", "BK1026"), ("云计算", "BK0963"),
    ]
    result = []
    for name, code in sectors:
        result.append({
            "name": name,
            "code": code,
            "change_pct": round(random.uniform(-5, 8), 2),
            "up_count": random.randint(3, 30),
            "down_count": random.randint(2, 25),
            "turnover_rate": round(random.uniform(0.5, 6.0), 2),
            "lead_stock": random.choice(["贵州茅台", "宁德时代", "中兴通讯", "科大讯飞", "比亚迪"]),
        })
    result.sort(key=lambda x: x["change_pct"], reverse=True)
    return result


# ---------- 资金流向 ----------

def get_fund_flow(code: str) -> dict:
    """获取个股资金流向"""
    cache_key = f"fundflow:{code}"
    cached = cache.get(cache_key)
    if cached:
        _set_last_source("fundflow", "cache")
        return cached

    try:
        secid = _to_market_code(code)
        params = {
            "fields1": "f1,f2,f3,f4",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62",
            "secid": secid,
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        }
        data = _em_get("https://push2.eastmoney.com/api/qt/stock/fflow/kline/get", params, timeout=8, retries=1)
        klines = data.get("data", {}).get("klines", [])

        if not klines:
            return {}

        # 取最新一条
        latest = klines[-1].split(",")
        if len(latest) >= 11:
            result = {
                "date": latest[0],
                "main_net_inflow": float(latest[1]),
                "main_net_inflow_pct": float(latest[2]),
                "super_large_net_inflow": float(latest[3]),
                "large_net_inflow": float(latest[4]),
                "medium_net_inflow": float(latest[5]),
                "small_net_inflow": float(latest[6]),
            }
            cache.set(cache_key, result, ttl=120)
            _set_last_source("fundflow", "real")
            return result
        _set_last_source("fundflow", "unavailable")
        return {}
    except Exception as e:
        print(f"[EM] get_fund_flow({code}) failed: {e}")
        _set_last_source("fundflow", "unavailable")
        return {}


# ---------- 北向资金 ----------

def get_north_flow() -> dict:
    """获取北向资金净流入"""
    cache_key = "northflow"
    cached = cache.get(cache_key)
    if cached:
        _set_last_source("northflow", "cache")
        return cached

    try:
        params = {
            "fields1": "f1,f2,f3,f4",
            "fields2": "f51,f52,f53",
            "secid": "1.000300",  # 沪深300作为北向资金参考
            "klt": "101",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        }
        data = _em_get("https://push2.eastmoney.com/api/qt/stock/hsgt/index", {
            "fields1": "f1,f2,f3,f4",
            "fields2": "f51,f52,f53,f54",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        }, timeout=8, retries=1)
        items = data.get("data", {}).get("diff", [])
        if items:
            item = items[0]
            result = {
                "date": str(item.get("f51", "")),
                "net_inflow": float(item.get("f52", 0) or 0),
                "balance": float(item.get("f53", 0) or 0),
                "trend": [],
            }
            cache.set(cache_key, result, ttl=300)
            _set_last_source("northflow", "real")
            return result
        _set_last_source("northflow", "unavailable")
        return {}
    except Exception as e:
        print(f"[EM] get_north_flow failed: {e}")
        _set_last_source("northflow", "unavailable")
        return {}

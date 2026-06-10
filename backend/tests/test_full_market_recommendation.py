from pathlib import Path
import asyncio
import importlib.util
import sys
import types
from unittest.mock import AsyncMock, patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from services import akshare_service


def _install_signal_service_test_stubs() -> None:
    if importlib.util.find_spec("sqlalchemy") is not None:
        return

    sqlalchemy = types.ModuleType("sqlalchemy")
    sqlalchemy.select = lambda *args, **kwargs: None
    sqlalchemy.func = types.SimpleNamespace()
    sqlalchemy.and_ = lambda *args, **kwargs: None
    sqlalchemy_ext = types.ModuleType("sqlalchemy.ext")
    sqlalchemy_asyncio = types.ModuleType("sqlalchemy.ext.asyncio")
    sqlalchemy_asyncio.AsyncSession = type("AsyncSession", (), {})
    sys.modules["sqlalchemy"] = sqlalchemy
    sys.modules["sqlalchemy.ext"] = sqlalchemy_ext
    sys.modules["sqlalchemy.ext.asyncio"] = sqlalchemy_asyncio

    common = types.ModuleType("schemas.common")
    common.AppException = type("AppException", (Exception,), {})
    sys.modules["schemas.common"] = common

    for module_name, class_names in {
        "models.strategy": ("Strategy", "UserSubscription"),
        "models.signal": ("Signal",),
        "models.factor": ("FactorState",),
        "models.user": ("User",),
    }.items():
        module = types.ModuleType(module_name)
        for class_name in class_names:
            setattr(module, class_name, type(class_name, (), {}))
        sys.modules[module_name] = module

    factor_service = types.ModuleType("services.factor_service")
    factor_service.clamp = lambda value, lower, upper: max(lower, min(upper, value))
    sys.modules["services.factor_service"] = factor_service


_install_signal_service_test_stubs()
from services import signal_service


def stock(
    code: str,
    name: str,
    *,
    price: float = 10,
    change_pct: float = 1,
    volume: float = 100000,
    amount: float = 500000000,
    turnover_rate: float = 3,
    amplitude: float = 4,
    sector_name: str = "测试板块",
    sector_heat: float = 60,
) -> dict:
    return {
        "code": code,
        "name": name,
        "price": price,
        "change_pct": change_pct,
        "volume": volume,
        "amount": amount,
        "turnover_rate": turnover_rate,
        "amplitude": amplitude,
        "sector_name": sector_name,
        "sector_heat": sector_heat,
    }


def test_full_market_quotes_use_eastmoney_without_fixed_pool_fallback() -> None:
    payload = {
        "data": {
            "total": 2,
            "diff": [
                {
                    "f2": 10.5, "f3": 2.4, "f4": 0.25, "f5": 500000,
                    "f6": 800000000, "f7": 4.5, "f8": 3.2, "f12": "600001",
                    "f14": "测试沪股", "f15": 10.8, "f16": 10.1,
                    "f17": 10.2, "f18": 10.25, "f20": 5000000000,
                    "f21": 3500000000, "f23": 1.8, "f115": 20.0,
                },
                {
                    "f2": 22.0, "f3": -1.2, "f4": -0.27, "f5": 300000,
                    "f6": 500000000, "f7": 3.1, "f8": 2.1, "f12": "000001",
                    "f14": "测试深股", "f15": 22.5, "f16": 21.8,
                    "f17": 22.3, "f18": 22.27, "f20": 6000000000,
                    "f21": 4000000000, "f23": 1.4, "f115": 18.0,
                },
            ],
        },
    }

    with patch.object(akshare_service, "_em_get", return_value=payload):
        result = akshare_service.get_full_market_stock_list(force_refresh=True)

    assert result["total"] == 2
    assert {item["code"] for item in result["items"]} == {"600001.SH", "000001.SZ"}
    assert result["source"] == "eastmoney"
    assert result["quote_updated_at"]


def test_market_filter_removes_untradeable_and_illiquid_stocks() -> None:
    candidates = [
        stock("600001.SH", "正常股票"),
        stock("600002.SH", "*ST测试"),
        stock("600003.SH", "退市测试"),
        stock("600004.SH", "低价股", price=0.8),
        stock("600005.SH", "停牌股", volume=0, amount=0),
        stock("600006.SH", "低流动性", amount=1000000),
    ]

    result = signal_service._filter_recommendation_universe(candidates)

    assert [item["code"] for item in result] == ["600001.SH"]


def test_preselection_keeps_candidates_from_all_four_strategies() -> None:
    candidates = [
        stock("600010.SH", "低吸候选", change_pct=-2.5, amplitude=5),
        stock("600011.SH", "趋势候选", change_pct=5.5, turnover_rate=5),
        stock("600012.SH", "突破候选", change_pct=8.5, turnover_rate=7, amplitude=8),
        stock("600013.SH", "回归候选", change_pct=0.2, amplitude=6),
    ]

    result = signal_service._preselect_recommendation_candidates(candidates, per_mode_limit=10)

    assert set(result) == {"低吸", "趋势", "突破", "均值回归"}
    assert all(result[mode] for mode in result)


def test_final_selection_deduplicates_stocks_and_limits_sector_concentration() -> None:
    scored = {
        "低吸": [
            signal_service._realtime_signal_from_stock(
                stock(f"60000{i}.SH", f"同板块{i}", sector_name="热门板块"),
                "低吸",
                90 - i,
                "eastmoney",
            )
            for i in range(5)
        ],
        "趋势": [
            signal_service._realtime_signal_from_stock(
                stock("600001.SH", "重复股票", sector_name="热门板块"),
                "趋势",
                95,
                "eastmoney",
            ),
            signal_service._realtime_signal_from_stock(
                stock("000010.SZ", "其他板块", sector_name="其他板块"),
                "趋势",
                88,
                "eastmoney",
            ),
        ],
        "突破": [],
        "均值回归": [],
    }

    selected = signal_service._select_diversified_recommendations(scored, limit=5)

    codes = [item["stock_code"] for item in selected]
    assert len(codes) == len(set(codes))
    assert sum(item.get("sector_name") == "热门板块" for item in selected) <= 3


def test_default_daily_recommendation_limit_is_five() -> None:
    scored = {
        mode: [
            signal_service._realtime_signal_from_stock(
                stock(
                    f"{mode_index}{candidate_index:05d}.SZ",
                    f"{mode}候选{candidate_index}",
                    sector_name=f"{mode}板块{candidate_index}",
                ),
                mode,
                95 - candidate_index,
                "eastmoney",
            )
            for candidate_index in range(3)
        ]
        for mode_index, mode in enumerate(signal_service.MAINLINE_MODES, start=1)
    }

    selected = signal_service._select_diversified_recommendations(scored)

    assert len(selected) == 5


def test_realtime_ids_include_trade_date() -> None:
    item = signal_service._realtime_signal_from_stock(
        stock("600001.SH", "日期标识"),
        "趋势",
        80,
        "eastmoney",
        trade_date="2026-06-09",
    )

    assert item["id"] == "rt-2026-06-09-趋势-600001.SH"


def test_base_recommendations_do_not_require_strategy_subscriptions() -> None:
    market_data = {
        "items": [
            stock("600101.SH", "趋势样本", change_pct=6, turnover_rate=5, amount=2_000_000_000),
            stock("600102.SH", "低吸样本", change_pct=-2, amplitude=6, amount=2_000_000_000),
        ],
        "source": "eastmoney",
        "quote_updated_at": "2026-06-09T10:00:00",
    }

    with patch.object(
        akshare_service,
        "get_full_market_stock_list",
        return_value=market_data,
    ), patch.object(signal_service, "_is_today", return_value=True):
        result = asyncio.run(
            signal_service._build_realtime_timing_signals(
                date_str="2026-06-09",
                mode="汇总",
                subscribed_strategy_ids=[],
                db=AsyncMock(),
            )
        )

    assert result
    assert {item["mode"] for item in result}.issubset(set(signal_service.MAINLINE_MODES))
    assert len({item["stock_code"] for item in result}) == len(result)


def test_unavailable_market_source_returns_no_recommendations() -> None:
    with patch.object(
        akshare_service,
        "get_full_market_stock_list",
        return_value={
            "items": [],
            "total": 0,
            "source": "unavailable",
            "quote_updated_at": "2026-06-09T10:00:00",
        },
    ), patch.object(signal_service, "_is_today", return_value=True):
        result = asyncio.run(
            signal_service._build_realtime_timing_signals(
                date_str="2026-06-09",
                mode="汇总",
                subscribed_strategy_ids=[],
                db=AsyncMock(),
            )
        )

    assert result == []


if __name__ == "__main__":
    test_full_market_quotes_use_eastmoney_without_fixed_pool_fallback()
    test_market_filter_removes_untradeable_and_illiquid_stocks()
    test_preselection_keeps_candidates_from_all_four_strategies()
    test_final_selection_deduplicates_stocks_and_limits_sector_concentration()
    test_default_daily_recommendation_limit_is_five()
    test_realtime_ids_include_trade_date()
    test_base_recommendations_do_not_require_strategy_subscriptions()
    test_unavailable_market_source_returns_no_recommendations()
    print("full-market recommendation behavior checks passed")

# Full-Market Stock Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed stock universe and subscription-gated recommendation path with a full-market, four-strategy recommendation pipeline that returns up to 12 reliable and diversified A-share candidates.

**Architecture:** Add a production-only full-market quote function in `akshare_service.py`, then keep candidate filtering, strategy scoring, deduplication, and diversification in `signal_service.py`. Timing and live-signal endpoints will share the same recommendation builder; user subscriptions remain relevant to persisted strategy signals and premium features, but no longer restrict the real-time base recommendation universe.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy async, requests, existing Eastmoney/Tencent adapters, TypeScript, React, lightweight Python and Node contract tests.

---

## File Map

- Modify `backend/services/akshare_service.py`: expose a full-market quote loader that never falls back to fixed or random stocks for recommendations.
- Modify `backend/services/signal_service.py`: filter the market, score all four strategies, deduplicate stocks, enforce strategy/sector caps, and remove subscription gating from base recommendations.
- Modify `backend/schemas/signal.py`: document optional recommendation metadata.
- Modify `src/types/signal.ts`: add optional recommendation metadata fields for frontend compatibility.
- Modify `src/pages/timing/MainlineTab.tsx`: display the market rank and secondary strategy tags without changing the page layout substantially.
- Modify `src/pages/timing/StockTab.tsx`: consume the unified recommendation output without duplicating the same stock across modes.
- Create `backend/tests/test_full_market_recommendation.py`: executable behavior tests for filtering, scoring, diversification, subscription independence, and failure handling.
- Create `scripts/qa/full-market-recommendation-contract-check.cjs`: static checks that prevent reintroducing the fixed pool and subscription gate.

### Task 1: Add a Reliable Full-Market Quote Source

**Files:**
- Modify: `backend/services/akshare_service.py`
- Create: `backend/tests/test_full_market_recommendation.py`
- Create: `scripts/qa/full-market-recommendation-contract-check.cjs`

- [ ] **Step 1: Write the failing full-market source behavior test**

Create `backend/tests/test_full_market_recommendation.py` with an import helper and this first test:

```python
from pathlib import Path
import sys
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from services import akshare_service


def test_full_market_quotes_use_eastmoney_without_fixed_pool_fallback() -> None:
    payload = {
        "data": {
            "total": 2,
            "diff": [
                {
                    "f2": 10.5, "f3": 2.4, "f4": 0.25, "f5": 500000,
                    "f6": 800000000, "f8": 3.2, "f12": "600001",
                    "f14": "测试沪股", "f15": 10.8, "f16": 10.1,
                    "f17": 10.2, "f18": 10.25, "f20": 5000000000,
                    "f21": 3500000000, "f23": 1.8, "f115": 20.0,
                },
                {
                    "f2": 22.0, "f3": -1.2, "f4": -0.27, "f5": 300000,
                    "f6": 500000000, "f8": 2.1, "f12": "000001",
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend
python3 tests/test_full_market_recommendation.py
```

Expected: FAIL because `get_full_market_stock_list` does not exist.

- [ ] **Step 3: Add the failing static contract check**

Create `scripts/qa/full-market-recommendation-contract-check.cjs`:

```javascript
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const marketService = fs.readFileSync(
  path.join(root, 'backend/services/akshare_service.py'),
  'utf8',
);
const signalService = fs.readFileSync(
  path.join(root, 'backend/services/signal_service.py'),
  'utf8',
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  marketService.includes('def get_full_market_stock_list'),
  'market service must expose a full-market recommendation source',
);
assert(
  signalService.includes('get_full_market_stock_list'),
  'recommendation builder must consume the full-market source',
);
assert(
  !/get_full_market_stock_list[\s\S]*_mock_stock_list/.test(marketService),
  'full-market recommendation source must not fall back to mock stocks',
);

console.log('full-market recommendation contract checks passed');
```

- [ ] **Step 4: Run the contract check to verify it fails**

Run:

```bash
node scripts/qa/full-market-recommendation-contract-check.cjs
```

Expected: FAIL with `market service must expose a full-market recommendation source`.

- [ ] **Step 5: Implement `get_full_market_stock_list`**

Add a focused function beside `get_stock_list` in `backend/services/akshare_service.py`:

```python
def get_full_market_stock_list(force_refresh: bool = False) -> dict:
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
```

Add required imports using the module's existing conventions:

```python
import logging
from datetime import date, datetime, timedelta

logger = logging.getLogger(__name__)
```

Do not modify `get_stock_list`; it remains available for the stock-list page and quote fallback behavior.

- [ ] **Step 6: Make the behavior test executable**

Append to `backend/tests/test_full_market_recommendation.py`:

```python
if __name__ == "__main__":
    test_full_market_quotes_use_eastmoney_without_fixed_pool_fallback()
    print("full-market recommendation behavior checks passed")
```

- [ ] **Step 7: Run tests**

Run:

```bash
cd backend
python3 tests/test_full_market_recommendation.py
cd ..
node scripts/qa/full-market-recommendation-contract-check.cjs
```

Expected: both commands PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/services/akshare_service.py backend/tests/test_full_market_recommendation.py scripts/qa/full-market-recommendation-contract-check.cjs
git commit -m "feat: add full-market recommendation quotes"
```

### Task 2: Filter and Preselect Full-Market Candidates

**Files:**
- Modify: `backend/services/signal_service.py`
- Modify: `backend/tests/test_full_market_recommendation.py`

- [ ] **Step 1: Write failing tests for market filtering**

Add these fixtures and tests:

```python
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
```

Call these tests from the file's `__main__` block.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend
python3 tests/test_full_market_recommendation.py
```

Expected: FAIL because `_filter_recommendation_universe` and `_preselect_recommendation_candidates` do not exist.

- [ ] **Step 3: Implement the base filter**

Add constants and helper in `backend/services/signal_service.py`:

```python
MIN_RECOMMENDATION_AMOUNT = 50_000_000
RECOMMENDATION_PRESELECT_PER_MODE = 60
RECOMMENDATION_LIMIT = 5
MAX_PER_MODE = 4
MAX_PER_SECTOR = 3


def _filter_recommendation_universe(stocks: list[dict]) -> list[dict]:
    result = []
    for stock in stocks:
        name = str(stock.get("name") or "")
        code = str(stock.get("code") or "")
        price = float(stock.get("price") or 0)
        volume = float(stock.get("volume") or 0)
        amount = float(stock.get("amount") or 0)
        if not code or not name:
            continue
        if "ST" in name.upper() or "退" in name:
            continue
        if price <= 1 or volume <= 0 or amount < MIN_RECOMMENDATION_AMOUNT:
            continue
        result.append(stock)
    return result
```

- [ ] **Step 4: Implement per-strategy preselection**

Add:

```python
def _preselection_score(stock: dict, mode: str) -> float:
    change_pct = float(stock.get("change_pct") or 0)
    turnover_rate = float(stock.get("turnover_rate") or 0)
    amplitude = float(stock.get("amplitude") or 0)
    amount = float(stock.get("amount") or 0)
    liquidity = min(amount / 1_000_000_000, 10)

    if mode == "低吸":
        return max(0, -change_pct) * 3 + amplitude + liquidity
    if mode == "趋势":
        return max(0, change_pct) * 3 + turnover_rate + liquidity
    if mode == "突破":
        return max(0, change_pct) * 2 + turnover_rate * 1.5 + amplitude + liquidity
    return max(0, 2 - abs(change_pct)) * 3 + amplitude + liquidity


def _preselect_recommendation_candidates(
    stocks: list[dict],
    per_mode_limit: int = RECOMMENDATION_PRESELECT_PER_MODE,
) -> dict[str, list[dict]]:
    result = {}
    for mode in MAINLINE_MODES:
        ranked = sorted(
            stocks,
            key=lambda stock: _preselection_score(stock, mode),
            reverse=True,
        )
        result[mode] = ranked[:per_mode_limit]
    return result
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd backend
python3 tests/test_full_market_recommendation.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/services/signal_service.py backend/tests/test_full_market_recommendation.py
git commit -m "feat: filter full-market recommendation candidates"
```

### Task 3: Score, Deduplicate, and Diversify Recommendations

**Files:**
- Modify: `backend/services/signal_service.py`
- Modify: `backend/tests/test_full_market_recommendation.py`

- [ ] **Step 1: Write failing diversification tests**

Add:

```python
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


def test_realtime_ids_include_trade_date() -> None:
    item = signal_service._realtime_signal_from_stock(
        stock("600001.SH", "日期标识"),
        "趋势",
        80,
        "eastmoney",
        trade_date="2026-06-09",
    )

    assert item["id"] == "rt-2026-06-09-趋势-600001.SH"
```

Call the tests from `__main__`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend
python3 tests/test_full_market_recommendation.py
```

Expected: FAIL because the selection helper and `trade_date` argument do not exist.

- [ ] **Step 3: Extend real-time signal metadata**

Change `_realtime_signal_from_stock`:

```python
def _realtime_signal_from_stock(
    stock: dict,
    mode: str,
    confidence: int,
    source: str,
    *,
    trade_date: str | None = None,
    secondary_modes: list[str] | None = None,
    market_rank: int | None = None,
    quote_updated_at: str | None = None,
) -> dict:
    current_trade_date = trade_date or date.today().isoformat()
    ...
    return {
        "id": f"rt-{current_trade_date}-{mode}-{code}",
        ...
        "secondary_modes": secondary_modes or [],
        "market_rank": market_rank,
        "quote_updated_at": quote_updated_at,
        "sector_name": str(stock.get("sector_name") or ""),
        ...
    }
```

- [ ] **Step 4: Implement deduplicated diversified selection**

Add:

```python
def _select_diversified_recommendations(
    candidates_by_mode: dict[str, list[dict]],
    limit: int = RECOMMENDATION_LIMIT,
) -> list[dict]:
    all_candidates = [
        signal
        for mode_candidates in candidates_by_mode.values()
        for signal in mode_candidates
    ]
    all_candidates.sort(
        key=lambda signal: (
            int(signal.get("confidence") or 0),
            float(signal.get("score_breakdown", {}).get("成交额_亿") or 0),
        ),
        reverse=True,
    )

    selected = []
    selected_codes = set()
    mode_counts = {mode: 0 for mode in MAINLINE_MODES}
    sector_counts: dict[str, int] = {}

    for signal in all_candidates:
        code = signal["stock_code"]
        mode = signal["mode"]
        sector = signal.get("sector_name") or "未分类"
        if code in selected_codes:
            continue
        if mode_counts.get(mode, 0) >= MAX_PER_MODE:
            continue
        if sector_counts.get(sector, 0) >= MAX_PER_SECTOR:
            continue

        selected.append(signal)
        selected_codes.add(code)
        mode_counts[mode] = mode_counts.get(mode, 0) + 1
        sector_counts[sector] = sector_counts.get(sector, 0) + 1
        if len(selected) >= limit:
            break

    return selected
```

- [ ] **Step 5: Replace `_build_diversified_realtime_signals` internals**

Keep its public role but change it to:

1. Score the preselected candidates for every mode.
2. Build one aggregate record per stock.
3. Assign the highest scoring mode as `mode`.
4. Put other passing modes into `secondary_modes`.
5. Call `_select_diversified_recommendations`.
6. Never fill missing slots with below-threshold or mock stocks.

Use this core shape:

```python
passing_by_code: dict[str, list[tuple[str, int]]] = {}
for candidate_mode, stocks in preselected.items():
    for stock in stocks:
        confidence = _score_realtime_stock(stock, candidate_mode)
        if confidence >= _threshold_for_mode(candidate_mode):
            passing_by_code.setdefault(stock["code"], []).append(
                (candidate_mode, confidence)
            )
```

Sort each stock's passing modes descending, build a signal from the highest pair, and pass the remainder as `secondary_modes`.

- [ ] **Step 6: Run tests**

Run:

```bash
cd backend
python3 tests/test_full_market_recommendation.py
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/services/signal_service.py backend/tests/test_full_market_recommendation.py
git commit -m "feat: diversify full-market recommendations"
```

### Task 4: Remove Subscription Gating From Base Recommendations

**Files:**
- Modify: `backend/services/signal_service.py`
- Modify: `backend/tests/test_full_market_recommendation.py`
- Modify: `scripts/qa/full-market-recommendation-contract-check.cjs`

- [ ] **Step 1: Write a failing async behavior test**

Add:

```python
import asyncio
from unittest.mock import AsyncMock


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
    ):
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
```

Use `patch.object(signal_service, "_is_today", return_value=True)` so the test is stable on later dates.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend
python3 tests/test_full_market_recommendation.py
```

Expected: FAIL because empty subscriptions currently return no recommendations.

- [ ] **Step 3: Change the recommendation builder contract**

Change `_build_realtime_timing_signals` so base strategy modes come from `_allowed_modes(mode)` directly:

```python
allowed_modes = list(_allowed_modes(mode))
if not allowed_modes:
    return []
```

Remove these lines from the real-time base recommendation path:

```python
subscribed_strategy_types = await _get_subscribed_strategy_types(...)
if not subscribed_strategy_types:
    return []
allowed_modes = [m for m in _allowed_modes(mode) if m in subscribed_strategy_types]
```

Keep `subscribed_strategy_ids` temporarily in the function signature to minimize router churn, but mark it as intentionally unused:

```python
_ = subscribed_strategy_ids
```

- [ ] **Step 4: Switch to the full-market source**

Replace:

```python
stock_data = await asyncio.to_thread(
    akshare_service.get_stock_list, 1, 80, "change_pct", "desc"
)
source = akshare_service.get_last_source("stocks")
```

with:

```python
stock_data = await asyncio.to_thread(
    akshare_service.get_full_market_stock_list
)
source = stock_data.get("source", "unavailable")
if source != "eastmoney":
    logger.warning("全市场行情源不可用，跳过实时推荐生成: source=%s", source)
    return []
```

Then filter and preselect:

```python
stocks = _filter_recommendation_universe(stock_data.get("items", []))
preselected = _preselect_recommendation_candidates(stocks)
```

- [ ] **Step 5: Strengthen the contract check**

Append:

```javascript
assert(
  !/subscribed_strategy_types[\s\S]*if not subscribed_strategy_types[\s\S]*return \[\]/.test(signalService),
  'base recommendations must not require strategy subscriptions',
);
assert(
  signalService.includes('_filter_recommendation_universe'),
  'recommendation builder must filter the full-market universe',
);
assert(
  signalService.includes('_select_diversified_recommendations'),
  'recommendation builder must diversify final selections',
);
```

- [ ] **Step 6: Run behavior and contract tests**

Run:

```bash
cd backend
python3 tests/test_full_market_recommendation.py
cd ..
node scripts/qa/full-market-recommendation-contract-check.cjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/services/signal_service.py backend/tests/test_full_market_recommendation.py scripts/qa/full-market-recommendation-contract-check.cjs
git commit -m "fix: make base recommendations subscription independent"
```

### Task 5: Expose Recommendation Metadata to the Frontend

**Files:**
- Modify: `backend/schemas/signal.py`
- Modify: `src/types/signal.ts`
- Modify: `src/pages/timing/MainlineTab.tsx`
- Modify: `src/pages/timing/StockTab.tsx`

- [ ] **Step 1: Add optional backend schema fields**

Extend `SignalOut`:

```python
    secondary_modes: list[str] = Field(default_factory=list)
    market_rank: int | None = None
    quote_updated_at: str | None = None
    sector_name: str | None = None
```

- [ ] **Step 2: Add matching frontend fields**

Extend `Signal` in `src/types/signal.ts`:

```typescript
  secondary_modes?: SignalTagType[];
  market_rank?: number;
  quote_updated_at?: string;
  sector_name?: string;
```

- [ ] **Step 3: Show compact metadata in `MainlineTab`**

Add columns without changing the overall terminal layout:

```typescript
{
  key: 'market_rank',
  title: '全市排名',
  width: 58,
  render: (value: unknown) => (
    <span className="text-text-secondary">
      {value ? `#${value as number}` : '-'}
    </span>
  ),
},
{
  key: 'secondary_modes',
  title: '辅助信号',
  width: 95,
  render: (value: unknown) => {
    const modes = (value as SignalTagType[] | undefined) || [];
    return (
      <span className="block truncate text-text-muted" title={modes.join('、')}>
        {modes.join('、') || '-'}
      </span>
    );
  },
},
```

- [ ] **Step 4: Deduplicate `StockTab` aggregation**

Replace simple array concatenation with code-based deduplication:

```typescript
const signals = useMemo(() => {
  const combined = [
    ...(timingSignals['个股'] || []),
    ...(timingSignals['低吸'] || []),
    ...(timingSignals['均值回归'] || []),
  ];
  return Array.from(
    new Map(combined.map((signal) => [signal.stock_code, signal])).values()
  );
}, [timingSignals]);
```

- [ ] **Step 5: Run frontend verification**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/signal.py src/types/signal.ts src/pages/timing/MainlineTab.tsx src/pages/timing/StockTab.tsx
git commit -m "feat: expose recommendation ranking metadata"
```

### Task 6: Verify Failure Handling, Regression Coverage, and Deployment

**Files:**
- Modify: `backend/tests/test_full_market_recommendation.py`
- Modify: `scripts/qa/full-market-recommendation-contract-check.cjs`
- Verify: `backend/main.py`
- Verify: `dist/`

- [ ] **Step 1: Add a failure-source behavior test**

Add:

```python
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
```

Call the test from `__main__`.

- [ ] **Step 2: Run the full backend behavior test**

Run:

```bash
cd backend
python3 tests/test_full_market_recommendation.py
```

Expected: PASS and print `full-market recommendation behavior checks passed`.

- [ ] **Step 3: Run every contract check**

Run:

```bash
for file in scripts/qa/*.cjs; do node "$file"; done
```

Expected: every check prints a `passed` message and the loop exits with code 0.

- [ ] **Step 4: Compile touched backend modules**

Run:

```bash
python3 -m py_compile \
  backend/services/akshare_service.py \
  backend/services/signal_service.py \
  backend/schemas/signal.py \
  backend/main.py
```

Expected: exit code 0 with no output.

- [ ] **Step 5: Build production frontend**

Run:

```bash
npm run build
```

Expected: `tsc -b && vite build` exits with code 0.

- [ ] **Step 6: Verify no fixed recommendation fallback remains**

Run:

```bash
grep -R "STOCK_UNIVERSE" backend/services/signal_service.py
grep -R "_mock_stock_list" backend/services/signal_service.py
```

Expected: both commands return no matches.

- [ ] **Step 7: Prepare clean deployment artifacts**

Run:

```bash
tar czf /tmp/ai-trader-static-clean.tar.gz -C dist .
cp backend/services/akshare_service.py /tmp/ai-trader-akshare-service.py
cp backend/services/signal_service.py /tmp/ai-trader-signal-service.py
cp backend/schemas/signal.py /tmp/ai-trader-signal-schema.py
cp backend/main.py /tmp/ai-trader-main.py
```

- [ ] **Step 8: Deploy backend and static files**

Run locally:

```bash
scp -i ~/.ssh/ai-trader-deploy \
  /tmp/ai-trader-static-clean.tar.gz \
  /tmp/ai-trader-akshare-service.py \
  /tmp/ai-trader-signal-service.py \
  /tmp/ai-trader-signal-schema.py \
  /tmp/ai-trader-main.py \
  ubuntu@43.156.76.110:/tmp/
```

Run remotely:

```bash
ssh -i ~/.ssh/ai-trader-deploy ubuntu@43.156.76.110 '
  cp /tmp/ai-trader-akshare-service.py /home/ubuntu/ai-trader-backend/services/akshare_service.py &&
  cp /tmp/ai-trader-signal-service.py /home/ubuntu/ai-trader-backend/services/signal_service.py &&
  cp /tmp/ai-trader-signal-schema.py /home/ubuntu/ai-trader-backend/schemas/signal.py &&
  cp /tmp/ai-trader-main.py /home/ubuntu/ai-trader-backend/main.py &&
  rm -rf /home/ubuntu/ai-trader-backend/static/* &&
  tar xzf /tmp/ai-trader-static-clean.tar.gz -C /home/ubuntu/ai-trader-backend/static/ &&
  sudo systemctl restart ai-trader &&
  sudo systemctl status ai-trader --no-pager
'
```

Expected: `ai-trader.service` is `active (running)`.

- [ ] **Step 9: Verify production**

Run:

```bash
curl --noproxy "*" http://43.156.76.110:11733/api/health
curl --noproxy "*" -I http://43.156.76.110:11733/
```

Expected:

- Health response contains `"status":"ok"`.
- HTML response contains `Cache-Control: no-store`.

Then log in through the web UI and verify:

1. Recommendations appear without adding any stocks to the watchlist.
2. Recommendations appear even when strategy subscriptions are absent.
3. The recommendation list is at most 5 stocks.
4. No stock appears twice.
5. No sector appears more than three times.
6. Refreshing after the quote cache expires recalculates from current full-market data.

- [ ] **Step 10: Commit final verification updates**

```bash
git add backend/tests/test_full_market_recommendation.py scripts/qa/full-market-recommendation-contract-check.cjs
git commit -m "test: cover full-market recommendation failures"
```

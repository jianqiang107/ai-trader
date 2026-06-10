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
const fullMarketFunction = marketService
  .split('def get_full_market_stock_list', 2)[1]
  ?.split('\ndef ', 1)[0] || '';

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
  !fullMarketFunction.includes('_mock_stock_list')
    && !fullMarketFunction.includes('STOCK_UNIVERSE'),
  'full-market recommendation source must not fall back to mock stocks',
);
assert(
  signalService.includes('_filter_recommendation_universe'),
  'recommendation builder must filter the full-market universe',
);
assert(
  !signalService.includes('if not subscribed_strategy_types:\n        return []'),
  'base recommendations must not require strategy subscriptions',
);

console.log('full-market recommendation contract checks passed');

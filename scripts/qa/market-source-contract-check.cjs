const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const commonSchema = read('backend/schemas/common.py');
const marketRouter = read('backend/routers/market.py');
const marketService = read('backend/services/akshare_service.py');
const signalService = read('backend/services/signal_service.py');

assert(commonSchema.includes('source:'), 'ApiResponse must expose an optional source field.');
assert(marketService.includes('def get_last_source'), 'market service must expose last data source metadata.');
assert(marketService.includes('TENCENT_QUOTE_URL'), 'market service must define Tencent quote endpoint.');
assert(marketService.includes('def _parse_tencent_quote'), 'market service must parse Tencent quote payloads.');
assert(marketService.includes('def _get_tencent_quotes'), 'market service must support Tencent batch quotes.');
assert(marketService.includes('_set_last_source("quote", "tencent")'), 'quote real branch must mark source=tencent.');
assert(marketService.includes('_set_last_source("stocks", "tencent")'), 'stock list real branch must mark source=tencent.');
assert(marketService.includes('_set_last_source("indices", "real")'), 'indices real branch must mark source=real.');
assert(marketService.includes('_set_last_source("indices", "fallback")'), 'indices fallback branch must mark source=fallback.');
assert(marketService.includes('_set_last_source("stocks", "real")'), 'stock list real branch must mark source=real.');
assert(marketService.includes('_set_last_source("stocks", "fallback")'), 'stock list fallback branch must mark source=fallback.');
assert(marketRouter.includes('source=svc.get_last_source("indices")'), 'indices endpoint must return source metadata.');
assert(marketRouter.includes('source=svc.get_last_source("stocks")'), 'stocks endpoint must return source metadata.');
assert(marketRouter.includes('source="mock"'), 'algorithmic mock endpoints must return source=mock.');

assert(!signalService.includes('MOCK_STOCKS'), 'signal generation must not contain a mock stock pool.');
assert(!signalService.includes('random.choice'), 'signal generation must not randomly choose stocks.');
assert(signalService.includes('get_full_market_stock_list'), 'signal generation must use full-market real stock selection.');

console.log('market source contract checks passed');

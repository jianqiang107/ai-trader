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

const signalService = read('backend/services/signal_service.py');

assert(signalService.includes('from services import akshare_service'), 'signal service must use real market quotes from akshare_service.');
assert(signalService.includes('def _build_realtime_timing_signals'), 'signal service must build realtime timing signals.');
assert(signalService.includes('get_full_market_stock_list'), 'realtime signals must use the full-market source.');
assert(signalService.includes('source != "eastmoney"'), 'realtime signals must fail closed unless full-market quotes are real.');
assert(signalService.includes('def _score_realtime_stock'), 'signal service must score realtime stocks deterministically.');
assert(signalService.includes('def _is_tradeable_candidate'), 'signal service must filter unsafe candidates such as ST stocks.');
assert(signalService.includes('"ST" not in name.upper()'), 'realtime signals must exclude ST stocks.');
assert(signalService.includes('rt-'), 'realtime signal ids must be distinguishable from persisted DB signals.');
assert(signalService.includes('calc_stop_loss_take_profit'), 'realtime signals must include stop loss and take profit prices.');
assert(signalService.includes('_select_diversified_recommendations'), 'realtime signals must deduplicate and diversify recommendations.');

console.log('realtime signal contract checks passed');

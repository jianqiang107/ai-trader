const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const marketService = read('backend/services/akshare_service.py');
const signalService = read('backend/services/signal_service.py');

for (const code of ['600246', '600482', '603268']) {
  assert(marketService.includes(`"${code}"`), `stock universe must include expert sample ${code}`);
}

assert(marketService.includes('STOCK_SECTOR_MAP'), 'market service must annotate stocks with sector names.');
assert(marketService.includes('板块强度'), 'market service must expose sector strength metadata.');
assert(signalService.includes('def _sector_heat_score'), 'signal service must score hot sectors.');
assert(signalService.includes('def _limit_up_candidate_score'), 'signal service must score near-limit-up candidates.');
assert(signalService.includes('强势低吸'), 'signal explanations must identify strong-sector dip-buying.');
assert(signalService.includes('涨停候选'), 'signal explanations must identify limit-up candidate logic.');
assert(signalService.includes('sector_heat'), 'signal score breakdown must include sector heat.');

console.log('limit-up sector strategy contract checks passed');

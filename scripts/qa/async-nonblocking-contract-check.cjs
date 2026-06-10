const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const signalService = fs.readFileSync(path.join(root, 'backend/services/signal_service.py'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(signalService.includes('import asyncio'), 'signal service must import asyncio for non-blocking sync IO handoff.');
assert(
  signalService.includes('asyncio.to_thread(akshare_service.get_full_market_stock_list'),
  'async signal endpoints must not call blocking full-market IO directly on the event loop.',
);

console.log('async nonblocking contract checks passed');

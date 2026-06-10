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
const signalTypes = read('src/types/signal.ts');
const mainlineTab = read('src/pages/timing/MainlineTab.tsx');
const stockTab = read('src/pages/timing/StockTab.tsx');

assert(signalService.includes('def _explain_realtime_stock'), 'backend must explain realtime stock selection.');
assert(signalService.includes('"reasons"'), 'realtime signal payload must include reasons.');
assert(signalService.includes('"score_breakdown"'), 'realtime signal payload must include score_breakdown.');
assert(signalService.includes('"data_source"'), 'realtime signal payload must include data_source.');
assert(signalService.includes('source == "tencent"'), 'realtime signal payload must expose Tencent data source.');

assert(signalTypes.includes('reasons?: string[]'), 'frontend Signal type must include optional reasons.');
assert(signalTypes.includes('score_breakdown?: Record<string, number>'), 'frontend Signal type must include optional score_breakdown.');
assert(signalTypes.includes('data_source?: string'), 'frontend Signal type must include optional data_source.');

assert(mainlineTab.includes("title: '入选原因'"), 'MainlineTab must display selection reasons.');
assert(stockTab.includes("title: '入选原因'"), 'StockTab must display selection reasons.');

console.log('signal explanation contract checks passed');

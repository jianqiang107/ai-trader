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
const signalCard = read('src/pages/signals/SignalCard.tsx');

assert(signalService.includes('_build_realtime_timing_signals('), 'live signals must reuse realtime timing signal builder.');
assert(signalService.includes('period == "today"'), 'live realtime signals must only be merged for today.');
assert(signalService.includes('realtime_live_signals'), 'get_live_signals must merge realtime live signals.');
assert(signalService.includes('signal_id.startswith("rt-")'), 'realtime signal actions must be handled without DB lookup failures.');
assert(signalService.includes('today_count += len(realtime_stats_signals)'), 'live stats must count realtime signals.');

assert(signalCard.includes('signal.reasons?.length'), 'SignalCard must display realtime signal reasons when available.');

console.log('live realtime contract checks passed');

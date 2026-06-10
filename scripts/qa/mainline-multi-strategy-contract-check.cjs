const fs = require('node:fs');
const path = require('node:path');

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
const mainlineTab = read('src/pages/timing/MainlineTab.tsx');
const mockSignals = read('src/mock/handlers/signals.ts');

for (const mode of ['低吸', '趋势', '突破', '均值回归']) {
  assert(signalService.includes(`"${mode}"`), `mainline backend must include ${mode} strategy`);
}

assert(
  /MAINLINE_MODES\s*=\s*\([^)]*"低吸"[^)]*"趋势"[^)]*"突破"[^)]*"均值回归"[^)]*\)/s.test(signalService),
  'MAINLINE_MODES must represent all four strategy-center strategies',
);
assert(
  signalService.includes('MAINLINE_STRATEGY_QUOTAS'),
  'realtime mainline generation must use multi-strategy quotas',
);
assert(
  signalService.includes('_build_diversified_realtime_signals'),
  'realtime mainline generation must diversify strategy modes instead of selecting one best mode only',
);
assert(
  !mainlineTab.includes("timingSignals['趋势']") && !mainlineTab.includes("timingSignals['突破']"),
  'MainlineTab should consume the automatic 主线 result instead of manually merging individual strategies',
);
assert(
  !mainlineTab.includes('趋势/突破'),
  'MainlineTab copy must not describe mainline as only trend/breakout',
);
assert(
  !mockSignals.includes("s.mode === '趋势' || s.mode === '突破'"),
  'mock timing handler must not limit 主线 to trend/breakout only',
);

console.log('mainline multi-strategy contract checks passed');

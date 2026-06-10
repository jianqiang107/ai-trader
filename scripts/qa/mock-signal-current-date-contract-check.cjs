const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'src/mock/handlers/signals.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  source.includes('buildDatedSignals'),
  'mock live signals must derive signal_time values from the current date instead of stale fixture dates',
);
assert(
  source.includes('isInPeriod'),
  'mock live signals must apply today/week/month period filtering',
);
assert(
  !source.includes("signal_time?.includes('2026-06-01')"),
  'mock live stats must not hard-code 2026-06-01 as today',
);
assert(
  !source.includes("new Date('2026-06-01')"),
  'mock signal handlers must not use 2026-06-01 as the current day',
);

console.log('mock signal current-date contract checks passed');

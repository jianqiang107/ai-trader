const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const summaryTab = fs.readFileSync(
  path.join(root, 'src/pages/timing/SummaryTab.tsx'),
  'utf8',
);
const summaryUtilsPath = path.join(root, 'src/utils/summarySignal.ts');
const signalHandlers = fs.readFileSync(
  path.join(root, 'src/mock/handlers/signals.ts'),
  'utf8',
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const title of ['入选板块', '涨幅', '入选价格', '入选涨幅', '今日盈亏']) {
  assert(summaryTab.includes(`title: '${title}'`), `stock summary must include ${title}`);
}

assert(fs.existsSync(summaryUtilsPath), 'stock summary must use a focused metric utility');
const summaryUtils = fs.existsSync(summaryUtilsPath)
  ? fs.readFileSync(summaryUtilsPath, 'utf8')
  : '';

assert(
  summaryUtils.includes('deduplicateSummarySignals'),
  'stock summary must deduplicate rows by stock code',
);
assert(
  summaryUtils.includes('getDailyChangePct'),
  'stock summary must derive the real daily change percentage',
);
assert(
  summaryUtils.includes('getSelectionReturnPct'),
  'stock summary must derive the return since selection',
);
assert(
  /getDailyChangePct\(b\)[\s\S]{0,40}-[\s\S]{0,40}getDailyChangePct\(a\)/.test(summaryTab),
  'stock summary must default to descending daily change',
);
assert(
  signalHandlers.includes('MOCK_MARKET_META'),
  'mock timing signals must include market metadata for the summary table',
);
assert(
  signalHandlers.includes("score_breakdown: { '涨跌幅': meta.changePct }"),
  'mock timing signals must expose the daily change percentage',
);

console.log('stock summary contract checks passed');

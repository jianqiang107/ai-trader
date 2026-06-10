const fs = require('node:fs');
const path = require('node:path');

const appPath = path.resolve(__dirname, '../../src/App.tsx');
const source = fs.readFileSync(appPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  source.includes('const routerBasename') || source.includes('getRouterBasename'),
  'App.tsx must compute a router basename for prefixed production URLs',
);
assert(
  source.includes("'/ai-trader'") || source.includes('"/ai-trader"'),
  'Router basename logic must explicitly support /ai-trader URLs',
);
assert(
  /<BrowserRouter\s+basename=\{[^}]+\}>/.test(source),
  'BrowserRouter must receive the computed basename',
);

console.log('router basename contract checks passed');

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

const backendMain = read('backend/main.py');

assert(
  backendMain.includes('Cache-Control') && backendMain.includes('no-store'),
  'SPA HTML responses must disable browser caching so clients do not keep stale chunk references',
);
assert(
  backendMain.includes('_serve_spa_file'),
  'backend static serving should use a shared helper for cache headers',
);

console.log('static cache contract checks passed');

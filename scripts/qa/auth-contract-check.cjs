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

const authService = read('src/services/authService.ts');

assert(
  /sendVerifyCode:\s*\(\s*phone:\s*string\s*\)/.test(authService),
  'authService.sendVerifyCode must accept and use a phone parameter, not discard it.'
);
assert(
  /api\.post\(\s*['"]\/user\/send-code['"]\s*,\s*\{\s*phone\s*\}\s*\)/.test(authService),
  'authService.sendVerifyCode must POST { phone } to /user/send-code.'
);
console.log('send-code compatibility checks passed');

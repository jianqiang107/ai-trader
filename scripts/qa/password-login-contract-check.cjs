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

const userTypes = read('src/types/user.ts');
const authService = read('src/services/authService.ts');
const loginDialog = read('src/components/common/LoginDialog.tsx');
const userSchema = read('backend/schemas/user.py');
const userModel = read('backend/models/user.py');
const userService = read('backend/services/user_service.py');
const database = read('backend/database.py');

assert(/LoginRequest[\s\S]*password:\s*string/.test(userTypes), 'frontend LoginRequest must use password.');
assert(!/LoginRequest[\s\S]*code:\s*string/.test(userTypes), 'frontend LoginRequest must not require verification code.');
assert(/api\.post\(\s*['"]\/user\/login['"]\s*,\s*req\s*\)/.test(authService), 'authService.login must post the password login request.');

assert(loginDialog.includes('type="password"'), 'LoginDialog must render a password field.');
assert(!loginDialog.includes('获取验证码'), 'LoginDialog must not render send-code login controls.');
assert(!loginDialog.includes('测试验证码'), 'LoginDialog must not show mock verification code in password login.');

assert(/class LoginRequest[\s\S]*password: str/.test(userSchema), 'backend LoginRequest must accept password.');
assert(!/class LoginRequest[\s\S]*code: str/.test(userSchema), 'backend LoginRequest must not require verification code.');
assert(userModel.includes('password_hash'), 'User model must persist a password_hash.');
assert(userService.includes('verify_password'), 'user_service must verify password hashes.');
assert(userService.includes('hash_password'), 'user_service must hash passwords.');
assert(/login\(\s*phone:\s*str,\s*password:\s*str/.test(userService), 'user_service.login must accept phone and password.');
assert(database.includes('ALTER TABLE users ADD COLUMN password_hash'), 'database init must migrate existing users with a password_hash column.');
assert(database.includes('ADMIN_PASSWORD'), 'admin seed/migration must use ADMIN_PASSWORD from configuration.');

console.log('password login contract checks passed');

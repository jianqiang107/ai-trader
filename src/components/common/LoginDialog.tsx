import { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import type { LoginRequest, RegisterRequest } from '../../types';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register';

export default function LoginDialog({ open, onClose }: LoginDialogProps) {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [mode, setMode] = useState<AuthMode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async () => {
    if (!phone || !password) {
      setError('请填写完整信息');
      return;
    }
    if (phone.length !== 11) {
      setError('请输入正确的手机号');
      return;
    }
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }
    if (mode === 'register' && !nickname) {
      setError('请输入昵称');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (mode === 'login') {
        const req: LoginRequest = { phone, password };
        await login(req);
      } else {
        const req: RegisterRequest = { phone, password, nickname };
        await register(req);
      }
      onClose();
    } catch (e) {
      setError(mode === 'login' ? '登录失败，请检查账号或密码' : '注册失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[380px] rounded-lg border border-border p-6"
        style={{ background: 'var(--bg-panel, #1c1c1c)' }}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-text-primary text-base font-semibold">
            {mode === 'login' ? '登录' : '注册'}
          </h3>
          <button
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* 手机号 */}
        <div className="mb-3">
          <label className="block text-text-secondary text-xs mb-1">手机号</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="请输入手机号"
            maxLength={11}
            className="w-full bg-bg-secondary border border-border text-text-primary text-sm px-3 py-2 rounded focus:outline-none focus:border-orange/50"
          />
        </div>

        {/* 密码 */}
        <div className="mb-3">
          <label className="block text-text-secondary text-xs mb-1">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full bg-bg-secondary border border-border text-text-primary text-sm px-3 py-2 rounded focus:outline-none focus:border-orange/50"
          />
        </div>

        {/* 昵称（注册时显示） */}
        {mode === 'register' && (
          <div className="mb-3">
            <label className="block text-text-secondary text-xs mb-1">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="请输入昵称"
              className="w-full bg-bg-secondary border border-border text-text-primary text-sm px-3 py-2 rounded focus:outline-none focus:border-orange/50"
            />
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mb-3 text-rise text-xs text-center">{error}</div>
        )}
        {/* 提交按钮 */}
        <button
          className="w-full py-2 rounded text-sm font-medium bg-orange text-black hover:bg-orange/80 transition-colors disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>

        {/* 切换模式 */}
        <div className="mt-4 text-center text-xs text-text-muted">
          {mode === 'login' ? (
            <>
              还没有账号？
              <button className="text-orange hover:underline ml-1" onClick={switchMode}>
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button className="text-orange hover:underline ml-1" onClick={switchMode}>
                立即登录
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

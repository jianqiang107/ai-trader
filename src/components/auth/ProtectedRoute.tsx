import { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import LoginDialog from '../common/LoginDialog';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 路由守卫组件：包裹需要认证的页面路由。
 * 未认证时显示登录对话框（而非重定向），避免与 401 拦截器产生循环跳转。
 * 认证成功后自动关闭对话框并渲染子组件。
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [dialogOpen, setDialogOpen] = useState(!isAuthenticated);

  // 已认证时直接渲染子组件
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // 未认证：渲染登录对话框 + 遮挡层
  const handleClose = () => {
    setDialogOpen(false);
  };

  return (
    <>
      {/* 遮挡层：提示用户需要登录 */}
      <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm gap-3">
        <div className="text-3xl">🔒</div>
        <div>该页面需要登录后访问</div>
        <button
          className="px-4 py-1.5 bg-orange text-black rounded text-sm font-medium hover:bg-orange/80 transition-colors"
          onClick={() => setDialogOpen(true)}
        >
          立即登录
        </button>
      </div>

      {/* 登录对话框 */}
      <LoginDialog open={dialogOpen} onClose={handleClose} />
    </>
  );
}

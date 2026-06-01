import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/useAuthStore';

const PLAN_LABELS: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  flagship: '旗舰版',
};

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  free: { bg: 'rgba(102,102,102,0.15)', text: '#999' },
  pro: { bg: 'rgba(255,140,0,0.15)', text: '#ff8c00' },
  flagship: { bg: 'rgba(232,64,64,0.15)', text: '#e84040' },
};

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenAlertPref: () => void;
  onOpenNotificationCenter: () => void;
}

const MENU_ITEMS = [
  { icon: '⭐', label: '我的自选', path: '/watchlist' },
  { icon: '🎯', label: '我的策略', path: '/strategy' },
  { icon: '🔔', label: '预警设置', action: 'alert' as const },
  { icon: '📬', label: '消息通知', action: 'notification' as const },
  { icon: '👑', label: '会员管理', path: '/membership' },
];

export default function ProfileDrawer({
  open,
  onClose,
  onOpenAlertPref,
  onOpenNotificationCenter,
}: ProfileDrawerProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const handleMenuClick = (item: (typeof MENU_ITEMS)[number]) => {
    if (item.action === 'alert') {
      onClose();
      onOpenAlertPref();
    } else if (item.action === 'notification') {
      onClose();
      onOpenNotificationCenter();
    } else if (item.path) {
      onClose();
      navigate(item.path);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  const currentPlan = user?.plan ?? 'free';
  const planStyle = PLAN_COLORS[currentPlan] ?? PLAN_COLORS.free;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />

          {/* 抽屉 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 z-50 h-full border-l border-border flex flex-col"
            style={{ width: 320, background: 'var(--bg-panel, #1c1c1c)' }}
          >
            {/* 头部：头像+昵称+会员等级 */}
            <div className="px-5 py-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #ff8c00, #e84040)' }}
                >
                  {isAuthenticated && user?.nickname
                    ? user.nickname.charAt(0)
                    : '?'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary text-sm font-semibold">
                      {isAuthenticated ? user?.nickname ?? '用户' : '未登录'}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px]"
                      style={{ background: planStyle.bg, color: planStyle.text }}
                    >
                      {PLAN_LABELS[currentPlan]}
                    </span>
                  </div>
                  {isAuthenticated && user?.phone && (
                    <div className="text-text-muted text-xs mt-0.5">{user.phone}</div>
                  )}
                </div>
              </div>
            </div>

            {/* 中间：分组列表 */}
            <div className="flex-1 overflow-y-auto py-2">
              {MENU_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-bg-secondary transition-colors"
                  onClick={() => handleMenuClick(item)}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-text-secondary text-xs flex-1">{item.label}</span>
                  <span className="text-text-muted text-xs">›</span>
                </div>
              ))}
            </div>

            {/* 底部：退出登录 */}
            <div className="px-5 py-4 border-t border-border shrink-0">
              {isAuthenticated ? (
                <button
                  className="w-full py-2 rounded text-xs bg-bg-secondary border border-border text-text-secondary hover:text-rise hover:border-rise/30 transition-colors"
                  onClick={handleLogout}
                >
                  退出登录
                </button>
              ) : (
                <div className="text-text-muted text-xs text-center">请先登录</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

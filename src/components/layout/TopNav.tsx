import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

const NAV_ITEMS = [
  { label: '首页', path: '/timing' },
  { label: '策略中心', path: '/strategy' },
  { label: '实盘信号', path: '/signals' },
  { label: '量化回测', path: '/performance' },
  { label: '资讯中心', path: '/news' },
  { label: '会员服务', path: '/membership' },
];

/** 二级导航映射：首页下的子Tab路由 */
const HOME_TABS = [
  { label: '择时系统', path: '/timing' },
  { label: '模拟业绩', path: '/performance' },
  { label: '板块列表', path: '/sectors' },
  { label: '股票列表', path: '/stocks' },
  { label: '自选列表', path: '/watchlist' },
];

interface TopNavProps {
  onOpenProfile: () => void;
  onOpenNotificationCenter: () => void;
  onOpenAlertPref: () => void;
}

export default function TopNav({ onOpenProfile, onOpenNotificationCenter, onOpenAlertPref }: TopNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useAuthStore((s) => s.unreadCount);

  /** 判断一级导航是否激活 */
  const isNavActive = (path: string) => {
    if (path === '/timing') return location.pathname === '/' || location.pathname === '/timing';
    return location.pathname.startsWith(path);
  };

  /** 判断是否在首页子Tab下（用于显示二级导航） */
  const isHomeSubPage = HOME_TABS.some((tab) => location.pathname.startsWith(tab.path));

  return (
    <>
      {/* 顶部一级导航 */}
      <div className="h-[44px] bg-[#0d0d0d] border-b border-border flex items-center px-3 gap-4 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-[160px]">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #ff8c00, #e84040)' }}
          >
            AI
          </div>
          <span className="text-[15px] font-bold text-white tracking-wider">AI交易大师</span>
        </div>

        {/* 一级导航 */}
        <div className="flex gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.path}
              className={`px-3 py-1 rounded cursor-pointer text-xs whitespace-nowrap transition-all ${
                isNavActive(item.path)
                  ? 'text-orange bg-orange/10'
                  : 'text-text-secondary hover:text-orange hover:bg-orange/5'
              }`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* 右侧区域 */}
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span>客服热线：</span>
          <span className="text-orange font-semibold">400-888-8888</span>

          {/* 铃铛 */}
          <div
            className="w-[26px] h-[26px] bg-bg-panel border border-border rounded flex items-center justify-center cursor-pointer text-text-secondary hover:text-orange hover:border-orange transition-all relative"
            onClick={onOpenNotificationCenter}
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rise rounded-full text-[9px] text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>

          {/* 设置 */}
          <div
            className="w-[26px] h-[26px] bg-bg-panel border border-border rounded flex items-center justify-center cursor-pointer text-text-secondary hover:text-orange hover:border-orange transition-all"
            onClick={onOpenAlertPref}
          >
            ⚙
          </div>

          {/* 用户 */}
          <div
            className="w-[26px] h-[26px] bg-bg-panel border border-border rounded flex items-center justify-center cursor-pointer text-text-secondary hover:text-orange hover:border-orange transition-all"
            onClick={onOpenProfile}
          >
            👤
          </div>
        </div>
      </div>

      {/* 二级Tab栏（仅首页子页面显示） */}
      {isHomeSubPage && (
        <div className="h-9 bg-[#0d0d0d] border-b border-border flex items-center px-3 gap-0.5 shrink-0">
          {HOME_TABS.map((tab) => (
            <div
              key={tab.path}
              className={`px-4 py-1.5 cursor-pointer text-[13px] rounded-t relative transition-all whitespace-nowrap ${
                location.pathname === tab.path
                  ? 'text-orange bg-bg-secondary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => navigate(tab.path)}
            >
              {tab.label}
              {location.pathname === tab.path && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange" />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

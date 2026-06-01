import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/useAuthStore';
import type { Notification } from '../../types';
import { formatTime, formatDate } from '../../utils/format';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

/** 通知类型图标 */
function getNotificationIcon(type: Notification['type']): string {
  switch (type) {
    case 'signal':
      return '📊';
    case 'system':
      return '🔔';
    case 'expiry':
      return '⏰';
    default:
      return '📢';
  }
}

/** 通知类型标签颜色 */
function getNotificationTypeColor(type: Notification['type']): string {
  switch (type) {
    case 'signal':
      return 'text-orange';
    case 'system':
      return 'text-blue';
    case 'expiry':
      return 'text-rise';
    default:
      return 'text-text-muted';
  }
}

const TYPE_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'signal', label: '信号' },
  { value: 'system', label: '系统' },
  { value: 'expiry', label: '到期' },
] as const;

export default function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const notifications = useAuthStore((s) => s.notifications);
  const unreadCount = useAuthStore((s) => s.unreadCount);
  const fetchNotifications = useAuthStore((s) => s.fetchNotifications);
  const markNotificationRead = useAuthStore((s) => s.markNotificationRead);
  const markAllRead = useAuthStore((s) => s.markAllRead);

  const [activeFilter, setActiveFilter] = useState<'all' | 'signal' | 'system' | 'expiry'>('all');

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const filteredNotifications = activeFilter === 'all'
    ? notifications
    : notifications.filter((n) => n.type === activeFilter);

  const handleNotificationClick = (id: string) => {
    markNotificationRead(id);
  };

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

          {/* 侧滑面板 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 z-50 h-full w-[360px] border-l border-border flex flex-col"
            style={{ background: 'var(--bg-panel, #1c1c1c)' }}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-text-primary text-sm font-semibold">消息通知</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-rise rounded-full text-[10px] text-white font-medium">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    className="text-text-muted text-[10px] hover:text-orange transition-colors"
                    onClick={markAllRead}
                  >
                    全部已读
                  </button>
                )}
                <button
                  className="text-text-muted hover:text-text-primary text-lg leading-none"
                  onClick={onClose}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* 类型筛选 */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border shrink-0">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    activeFilter === filter.value
                      ? 'bg-orange/15 text-orange border border-orange/30'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                  onClick={() => setActiveFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* 通知列表 */}
            <div className="flex-1 overflow-y-auto">
              {filteredNotifications.length > 0 ? (
                <div className="divide-y divide-border">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 cursor-pointer hover:bg-bg-secondary transition-colors ${
                        !notification.read ? 'bg-orange/3' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification.id)}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* 图标 */}
                        <span className="text-base mt-0.5">{getNotificationIcon(notification.type)}</span>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-text-primary text-xs font-medium truncate">
                              {notification.title}
                            </span>
                            {!notification.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rise shrink-0" />
                            )}
                          </div>
                          <p className="text-text-muted text-[11px] leading-relaxed mb-1">
                            {notification.content}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] ${getNotificationTypeColor(notification.type)}`}>
                              {TYPE_FILTERS.find((f) => f.value === notification.type)?.label}
                            </span>
                            <span className="text-text-muted text-[10px]">
                              {formatDate(notification.created_at)} {formatTime(notification.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-text-muted text-sm">
                  暂无通知
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

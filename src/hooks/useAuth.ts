import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import type { User, Notification } from '../types';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  notifications: Notification[];
  unreadCount: number;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  register: (phone: string, password: string, nickname: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  /** 是否显示登录弹窗 */
  showLoginDialog: boolean;
  setShowLoginDialog: (show: boolean) => void;
  /** 是否显示通知面板 */
  showNotificationCenter: boolean;
  setShowNotificationCenter: (show: boolean) => void;
}

/** 认证Hook — 封装认证Store，提供登录/注册/通知相关操作 */
export function useAuth(): UseAuthReturn {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const notifications = useAuthStore((s) => s.notifications);
  const unreadCount = useAuthStore((s) => s.unreadCount);
  const storeLogin = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const storeRegister = useAuthStore((s) => s.register);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const fetchNotifications = useAuthStore((s) => s.fetchNotifications);
  const markNotificationRead = useAuthStore((s) => s.markNotificationRead);
  const markAllRead = useAuthStore((s) => s.markAllRead);

  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  /** 登录（封装Store方法，接收单独参数） */
  const login = useCallback(async (phone: string, password: string) => {
    await storeLogin({ phone, password });
  }, [storeLogin]);

  /** 注册（封装Store方法，接收单独参数） */
  const register = useCallback(async (phone: string, password: string, nickname: string) => {
    await storeRegister({ phone, password, nickname });
  }, [storeRegister]);

  /** 已登录时自动拉取用户信息 */
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchProfile();
    }
  }, [isAuthenticated, user, fetchProfile]);

  return {
    user,
    isAuthenticated,
    notifications,
    unreadCount,
    login,
    logout,
    register,
    fetchProfile,
    fetchNotifications,
    markNotificationRead,
    markAllRead,
    showLoginDialog,
    setShowLoginDialog,
    showNotificationCenter,
    setShowNotificationCenter,
  };
}

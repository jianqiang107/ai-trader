import { create } from 'zustand';
import type { User, LoginRequest, RegisterRequest, AlertSetting, Notification } from '../types';
import { userService } from '../services/userService';

interface UserState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  notifications: Notification[];
  unreadCount: number;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => void;
  register: (req: RegisterRequest) => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateAlertSettings: (settings: Partial<AlertSetting>) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  notifications: [],
  unreadCount: 0,

  login: async (req: LoginRequest) => {
    try {
      const res = await userService.login(req);
      localStorage.setItem('token', res.token);
      set({ user: res.user, token: res.token, isAuthenticated: true });
    } catch (e) {
      console.error('Login failed:', e);
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, notifications: [], unreadCount: 0 });
  },

  register: async (req: RegisterRequest) => {
    try {
      await userService.register(req);
    } catch (e) {
      console.error('Register failed:', e);
      throw e;
    }
  },

  fetchProfile: async () => {
    try {
      const user = await userService.getProfile();
      set({ user });
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    }
  },

  updateAlertSettings: async (settings: Partial<AlertSetting>) => {
    try {
      await userService.updateAlertSettings(settings);
      const user = get().user;
      if (user) {
        set({ user: { ...user, alert_settings: { ...user.alert_settings, ...settings } } });
      }
    } catch (e) {
      console.error('Failed to update alert settings:', e);
    }
  },

  fetchNotifications: async () => {
    try {
      const data = await userService.getNotifications();
      const unread = data.filter((n) => !n.read).length;
      set({ notifications: data, unreadCount: unread });
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  },

  markNotificationRead: (id: string) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return { notifications, unreadCount: Math.max(0, state.unreadCount - 1) };
    });
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },
}));

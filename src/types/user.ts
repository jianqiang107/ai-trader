import type { AlertSetting } from './signal';
import type { PlanLevel } from './strategy';

/** 用户 */
export interface User {
  id: string;
  phone: string;
  nickname: string;
  avatar: string;
  plan: PlanLevel;
  plan_expires_at: string | null;
  auto_renew: boolean;
  watchlist: string[];
  signal_preferences: Record<string, unknown>;
  alert_settings: AlertSetting;
}

/** 登录请求 */
export interface LoginRequest {
  phone: string;
  code: string;
}

/** 注册请求 */
export interface RegisterRequest {
  phone: string;
  code: string;
  nickname: string;
}

/** 登录响应 */
export interface LoginResponse {
  token: string;
  user: User;
}

/** 通知消息 */
export interface Notification {
  id: string;
  type: 'signal' | 'system' | 'expiry';
  title: string;
  content: string;
  read: boolean;
  created_at: string;
}

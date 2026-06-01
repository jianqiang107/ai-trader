import api from './api';
import type { User, LoginRequest, LoginResponse, RegisterRequest, Notification, AlertSetting } from '../types';

export const userService = {
  /** 登录 */
  login: (req: LoginRequest): Promise<LoginResponse> =>
    api.post('/user/login', req),

  /** 注册 */
  register: (req: RegisterRequest): Promise<void> =>
    api.post('/user/register', req),

  /** 获取用户信息 */
  getProfile: (): Promise<User> =>
    api.get('/user/profile'),

  /** 更新预警设置 */
  updateAlertSettings: (settings: Partial<AlertSetting>): Promise<void> =>
    api.put('/user/alert-settings', settings),

  /** 获取通知列表 */
  getNotifications: (): Promise<Notification[]> =>
    api.get('/user/notifications'),
};

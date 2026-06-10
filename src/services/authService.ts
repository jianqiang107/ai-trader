import api from './api';
import type { LoginRequest, LoginResponse, RegisterRequest, SendCodeResponse } from '../types';

export const authService = {
  /** 登录 */
  login: (req: LoginRequest): Promise<LoginResponse> =>
    api.post('/user/login', req),

  /** 注册 */
  register: (req: RegisterRequest): Promise<void> =>
    api.post('/user/register', req),

  /** 登出(前端清除token即可，后端无需接口) */
  logout: (): void => {
    localStorage.removeItem('token');
  },

  /** 获取验证码 */
  sendVerifyCode: (phone: string): Promise<SendCodeResponse | null> =>
    api.post('/user/send-code', { phone }),

  /** 刷新token */
  refreshToken: (): Promise<LoginResponse> =>
    api.post('/user/refresh-token'),
};

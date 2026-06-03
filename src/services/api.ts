import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

/** 自定义请求配置扩展，支持 skipAuthRedirect 标记 */
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /** 如果为 true，401 时不会触发全局跳转到首页 */
    skipAuthRedirect?: boolean;
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** 防止重复跳转的标志位 */
let isRedirecting = false;

/** 请求拦截器 - 注入token */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 响应拦截器 - 统一处理响应格式 { code, data, message } */
api.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code !== undefined && res.code !== 0) {
      console.error(`API Error [${res.code}]: ${res.message}`);
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    return res.data !== undefined ? res.data : res;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');

      // 检查是否应跳过全局跳转（某些请求自行处理 401）
      const skipRedirect = error.config?.skipAuthRedirect === true;
      // 检查当前路径是否已在首页或登录页，避免死循环
      const currentPath = window.location.pathname;
      const isAlreadyOnSafePage = currentPath === '/' || currentPath === '/login';

      if (!skipRedirect && !isAlreadyOnSafePage && !isRedirecting) {
        isRedirecting = true;
        window.location.href = '/';
        // 3 秒后重置标志位，允许后续合法跳转
        setTimeout(() => { isRedirecting = false; }, 3000);
      }
    }
    return Promise.reject(error);
  }
);

export default api;

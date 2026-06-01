/** 颜色常量 */
export const COLORS = {
  rise: '#e84040',
  fall: '#00c0a0',
  orange: '#ff8c00',
  blue: '#4a9eff',
  greenMA: '#00e676',
  bgPrimary: '#0a0a0a',
  bgSecondary: '#111111',
  bgPanel: '#1c1c1c',
  border: '#2a2a2a',
  borderLight: '#333333',
  textPrimary: '#e0e0e0',
  textSecondary: '#aaaaaa',
  textMuted: '#666666',
} as const;

/** 信号标签颜色映射 */
export const SIGNAL_TAG_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '低吸': { bg: 'rgba(255,140,0,0.15)', color: '#ff8c00', border: 'rgba(255,140,0,0.3)' },
  '趋势': { bg: 'rgba(74,158,255,0.1)', color: '#4a9eff', border: 'rgba(74,158,255,0.3)' },
  '突破': { bg: 'rgba(0,192,160,0.1)', color: '#00c0a0', border: 'rgba(0,192,160,0.3)' },
  '均值回归': { bg: 'rgba(156,39,176,0.1)', color: '#9c27b0', border: 'rgba(156,39,176,0.3)' },
};

/** MA线颜色 */
export const MA_COLORS = {
  ma5: '#00e676',
  ma10: '#69f0ae',
  ma20: '#00bcd4',
  ma30: '#26c6da',
} as const;

/** API基础地址 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/** 指数列表 */
export const INDICES = [
  { name: '上证指数', code: '000001.SH', base: 3285 },
  { name: '深证成指', code: '399001.SZ', base: 11420 },
  { name: '创业板指', code: '399006.SZ', base: 2210 },
  { name: '科创50', code: '000688.SH', base: 1050 },
  { name: '沪深300', code: '000300.SH', base: 3985 },
] as const;

/** 板块分类 */
export const SECTOR_TYPES = [
  { value: 'concept', label: '概念板块' },
  { value: 'industry', label: '行业板块' },
  { value: 'region', label: '地域板块' },
] as const;

/** 策略类型列表 */
export const STRATEGY_TYPES = ['低吸', '趋势', '突破', '均值回归'] as const;

/** 轮询间隔(ms) */
export const POLL_INTERVAL = 3000;

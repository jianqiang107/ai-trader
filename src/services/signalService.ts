import api from './api';
import type { Signal, LiveSignalFilter, LiveSignalStats, EmotionData, EmotionFlowData, AlertSetting } from '../types';

export const signalService = {
  /** 获取择时信号 */
  getTimingSignals: (date: string, mode: string): Promise<Signal[]> =>
    api.get('/signals/timing', { params: { date, mode } }),

  /** 获取情绪一号数据 */
  getEmotion1: (date: string): Promise<EmotionData[]> =>
    api.get('/signals/emotion1', { params: { date } }),

  /** 获取情绪二号数据 */
  getEmotion2: (date: string): Promise<EmotionFlowData[]> =>
    api.get('/signals/emotion2', { params: { date } }),

  /** 获取实盘信号列表 */
  getLiveSignals: (filter: LiveSignalFilter): Promise<Signal[]> =>
    api.get('/signals/live', { params: filter }),

  /** 获取实盘信号统计 */
  getLiveStats: (): Promise<LiveSignalStats> =>
    api.get('/signals/live/stats'),

  /** 确认信号 */
  acknowledgeSignal: (id: string, action: 'execute' | 'ignore'): Promise<void> =>
    api.post(`/signals/${id}/${action}`),

  /** 设置预警 */
  setAlert: (id: string, setting: AlertSetting): Promise<void> =>
    api.put(`/signals/${id}/alert`, setting),
};

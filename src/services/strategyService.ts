import api from './api';
import type { Strategy, StrategyType, FactorState, PerformanceData } from '../types';

export const strategyService = {
  /** 获取策略列表 */
  getStrategies: (type?: StrategyType, sort?: string): Promise<Strategy[]> =>
    api.get('/strategies', { params: { type, sort } }),

  /** 获取策略详情 */
  getStrategyDetail: (id: string): Promise<Strategy> =>
    api.get(`/strategies/${id}`),

  /** 获取策略绩效 */
  getPerformance: (id: string, start: string, end: string): Promise<PerformanceData> =>
    api.get(`/strategies/${id}/performance`, { params: { start, end } }),

  /** 订阅策略 */
  subscribeStrategy: (id: string): Promise<void> =>
    api.post(`/strategies/${id}/subscribe`),

  /** 获取因子状态 */
  getFactorStates: (id: string): Promise<FactorState[]> =>
    api.get(`/strategies/${id}/factors`),
};

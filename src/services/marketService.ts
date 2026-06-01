import api from './api';
import type { IndexData, KLineData, FenshiData, VolfsData } from '../types';

export const marketService = {
  /** 获取大盘指数 */
  getIndices: (): Promise<IndexData[]> => api.get('/market/indices'),

  /** 获取K线数据 */
  getKline: (code: string, period: string = 'daily'): Promise<KLineData[]> =>
    api.get(`/market/kline`, { params: { code, period } }),

  /** 获取分时数据 */
  getFenshi: (code: string): Promise<FenshiData[]> =>
    api.get(`/market/fenshi`, { params: { code } }),

  /** 获取VOLFS量能数据 */
  getVolfs: (code: string): Promise<VolfsData[]> =>
    api.get(`/market/volfs`, { params: { code } }),
};

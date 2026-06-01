import api from './api';
import type { WatchlistItem } from '../types';

export const watchlistService = {
  /** 获取自选列表 */
  getWatchlist: (): Promise<WatchlistItem[]> =>
    api.get('/watchlist'),

  /** 添加自选 */
  addToWatchlist: (code: string): Promise<void> =>
    api.post('/watchlist', { code }),

  /** 移除自选 */
  removeFromWatchlist: (code: string): Promise<void> =>
    api.delete(`/watchlist/${code}`),
};

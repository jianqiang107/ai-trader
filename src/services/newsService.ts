import api from './api';
import type { News, NewsCategory } from '../types';

export const newsService = {
  /** 获取资讯列表 */
  getNews: (category?: NewsCategory, page?: number, size?: number): Promise<News[]> =>
    api.get('/news', { params: { category, page, size } }),

  /** 获取资讯详情 */
  getNewsDetail: (id: string): Promise<News> =>
    api.get(`/news/${id}`),

  /** 获取底部滚动资讯 */
  getBottomNews: (): Promise<News[]> =>
    api.get('/news/bottom'),
};

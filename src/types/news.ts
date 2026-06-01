/** 情绪标签 */
export type Sentiment = '利好' | '利空' | '中性';

/** 资讯分类 */
export type NewsCategory = 'ai_picked' | 'market' | 'stock' | 'policy';

/** 资讯 */
export interface News {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  published_at: string;
  sentiment: Sentiment;
  impact_score: number;
  related_stocks: string[];
  related_sectors: string[];
  category: NewsCategory;
}

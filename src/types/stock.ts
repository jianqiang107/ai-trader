/** 市场 */
export type Market = 'SH' | 'SZ';

/** 信号标签类型 */
export type SignalTagType = '低吸' | '趋势' | '突破' | '均值回归';

/** 股票 */
export interface Stock {
  code: string;
  name: string;
  market: Market;
  price: number;
  change_pct: number;
  volume: number;
  turnover_rate: number;
  timing_score: number;
  signal_tags: SignalTagType[];
  sector_codes: string[];
}

/** 指数数据 */
export interface IndexData {
  name: string;
  code: string;
  price: number;
  change_pct: number;
  change_amount: number;
  open: number;
  high: number;
  low: number;
  pre_close: number;
  volume: number;
  amount: number;
  amplitude: number;
  volume_ratio: number;
}

/** 自选项 */
export interface WatchlistItem {
  code: string;
  name: string;
  price: number;
  change_pct: number;
  change_amount: number;
  volume: number;
  amount: number;
  amplitude: number;
}

/** 交易明细 */
export interface TradeDetail {
  id: string;
  stock_code: string;
  stock_name: string;
  strategy_id: string;
  buy_date: string;
  buy_price: number;
  position_pct: number;
  sell_date: string;
  sell_price: number;
  pnl_pct: number;
  sector: string;
}

/** 绩效数据 */
export interface PerformanceData {
  dates: string[];
  strategy_values: number[];
  benchmark_values: number[];
  total_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  trades: TradeDetail[];
}

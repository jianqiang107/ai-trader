import type { SignalTagType } from './stock';

/** 信号类型 */
export type SignalType = 'BUY' | 'SELL';

/** 信号状态 */
export type SignalStatus = 'pending' | 'executed' | 'ignored' | 'expired' | 'closed';

/** 预警状态 */
export type AlertStatus = 'safe' | 'warning' | 'stop_loss' | 'take_profit';

/** 交易信号 */
export interface Signal {
  id: string;
  stock_code: string;
  stock_name: string;
  signal_type: SignalType;
  strategy_id: string;
  signal_time: string;
  signal_price: number;
  mode: SignalTagType;
  confidence: number;
  status: SignalStatus;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  alert_status: AlertStatus;
  actual_pnl: number | null;
  holding_days?: number;
  current_price?: number;
  floating_pnl?: number;
}

/** 实盘信号筛选 */
export interface LiveSignalFilter {
  type: 'all' | 'BUY' | 'SELL';
  period: 'today' | 'week' | 'month';
  search?: string;
  onlyHolding?: boolean;
  onlyAlerting?: boolean;
}

/** 实盘信号统计 */
export interface LiveSignalStats {
  today_count: number;
  holding: number;
  take_profit: number;
  stop_loss: number;
  alerting: number;
}

/** 预警设置 */
export interface AlertSetting {
  stop_loss_price: number;
  take_profit_price: number;
  alert_method: 'notification' | 'sms' | 'wechat';
  alert_frequency: 'once' | 'daily' | 'every';
}

/** 择时信号映射 */
export interface TimingSignalMap {
  [mode: string]: Signal[];
}

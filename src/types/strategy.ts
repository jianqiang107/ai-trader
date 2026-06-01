import type { SignalTagType } from './stock';

/** 策略类型 */
export type StrategyType = '低吸' | '趋势' | '突破' | '均值回归';

/** 会员等级 */
export type PlanLevel = 'free' | 'pro' | 'flagship';

/** 风格预设 */
export type StylePreset = 'conservative' | 'balanced' | 'aggressive';

/** 策略 */
export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  description: string;
  total_return: number;
  win_rate: number;
  max_drawdown: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  running_days: number;
  signal_count: number;
  required_plan: PlanLevel;
  is_subscribed: boolean;
}

/** 预警设置 */
export interface AlertSetting {
  stop_loss_pct: number;
  take_profit_pct: number;
  alert_method: 'notification' | 'sms' | 'wechat';
  alert_frequency: 'once' | 'daily' | 'every';
}

/** 因子标签 */
export type FactorLabel =
  | '估值优势'
  | '涨势动力'
  | '资金热度'
  | '反弹潜力'
  | '市场温度'
  | '震荡程度'
  | '突破强度';

/** 因子状态 */
export interface FactorState {
  label: FactorLabel;
  value: number;
  change: number;
  status: 'normal' | 'warning' | 'danger';
}

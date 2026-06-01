import { motion } from 'framer-motion';
import type { Signal, AlertStatus } from '../../types';
import SignalTag from '../../components/common/SignalTag';
import { formatPrice, formatChangePct, formatTime, getChangeColorClass } from '../../utils/format';

interface SignalCardProps {
  signal: Signal;
  onExecute: (id: string) => void;
  onIgnore: (id: string) => void;
  onSetAlert: (signal: Signal) => void;
  onViewDetail: (signal: Signal) => void;
  onAddToWatchlist: (signal: Signal) => void;
}

/** 预警状态灯颜色 */
function getAlertDotColor(status: AlertStatus): string {
  switch (status) {
    case 'stop_loss':
      return '#e84040';
    case 'take_profit':
      return '#ff8c00';
    case 'warning':
      return '#ffcc00';
    case 'safe':
    default:
      return '#444444';
  }
}

/** 预警状态灯动画class */
function getAlertDotAnimation(status: AlertStatus): string {
  if (status === 'stop_loss' || status === 'warning') {
    return 'animate-pulse';
  }
  return '';
}

export default function SignalCard({
  signal,
  onExecute,
  onIgnore,
  onSetAlert,
  onViewDetail,
  onAddToWatchlist,
}: SignalCardProps) {
  const isAlerting = signal.alert_status === 'stop_loss' || signal.alert_status === 'warning';
  const isBuy = signal.signal_type === 'BUY';
  const floatingPnl = signal.floating_pnl ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg p-3 border transition-colors ${
        isAlerting
          ? 'border-rise/50 shadow-[0_0_8px_rgba(232,64,64,0.3)]'
          : 'border-border hover:border-border-light'
      }`}
      style={{ background: 'var(--bg-panel, #1c1c1c)' }}
    >
      <div className="flex items-start gap-3">
        {/* 左：股票信息+信号标签 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {/* 预警状态灯 */}
            <span
              className={`inline-block w-2 h-2 rounded-full ${getAlertDotAnimation(signal.alert_status)}`}
              style={{ background: getAlertDotColor(signal.alert_status) }}
            />

            <span className="text-text-primary font-semibold text-sm truncate">
              {signal.stock_name}
            </span>
            <span className="text-text-muted text-[11px]">{signal.stock_code}</span>

            {/* 信号类型标签 */}
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                isBuy
                  ? 'bg-orange/15 text-orange border border-orange/30'
                  : 'bg-fall/15 text-fall border border-fall/30'
              }`}
            >
              {isBuy ? '买入' : '卖出'}
            </span>

            {/* 策略模式标签 */}
            <SignalTag tag={signal.mode} />
          </div>

          {/* 信号详情行 */}
          <div className="flex items-center gap-4 text-[11px] text-text-secondary mb-1">
            <span>
              信号时间: <span className="text-text-primary">{formatTime(signal.signal_time)}</span>
            </span>
            <span>
              信号价: <span className="text-text-primary">{formatPrice(signal.signal_price)}</span>
            </span>
            {signal.current_price !== undefined && (
              <span>
                当前价: <span className="text-text-primary">{formatPrice(signal.current_price)}</span>
              </span>
            )}
            {signal.status === 'executed' && signal.current_price !== undefined && (
              <span>
                浮动盈亏:{' '}
                <span className={`font-semibold ${getChangeColorClass(floatingPnl)}`}>
                  {formatChangePct(floatingPnl)}
                </span>
              </span>
            )}
          </div>

          {/* 止损/止盈 */}
          <div className="flex items-center gap-4 text-[11px] text-text-muted">
            {signal.stop_loss_price !== null && signal.stop_loss_price > 0 && (
              <span>
                止损: <span className="text-rise">{formatPrice(signal.stop_loss_price)}</span>
              </span>
            )}
            {signal.take_profit_price !== null && signal.take_profit_price > 0 && (
              <span>
                止盈: <span className="text-fall">{formatPrice(signal.take_profit_price)}</span>
              </span>
            )}
            {signal.confidence > 0 && (
              <span>
                置信度: <span className="text-orange">{signal.confidence}%</span>
              </span>
            )}
          </div>
        </div>

        {/* 右：操作按钮 */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {signal.status === 'pending' && (
            <>
              <button
                className="px-2 py-0.5 bg-orange/15 border border-orange/30 text-orange rounded text-[10px] hover:bg-orange hover:text-black transition-colors"
                onClick={() => onExecute(signal.id)}
              >
                标记已执行
              </button>
              <button
                className="px-2 py-0.5 bg-bg-secondary border border-border text-text-muted rounded text-[10px] hover:text-text-primary transition-colors"
                onClick={() => onIgnore(signal.id)}
              >
                忽略
              </button>
            </>
          )}
          <div className="flex items-center gap-1">
            <button
              className="px-2 py-0.5 bg-bg-secondary border border-border text-text-secondary rounded text-[10px] hover:text-blue transition-colors"
              onClick={() => onViewDetail(signal)}
            >
              查看详情
            </button>
            <button
              className="px-2 py-0.5 bg-bg-secondary border border-border text-text-secondary rounded text-[10px] hover:text-orange transition-colors"
              onClick={() => onAddToWatchlist(signal)}
            >
              加自选
            </button>
            <button
              className="px-2 py-0.5 bg-bg-secondary border border-border text-text-secondary rounded text-[10px] hover:text-fall transition-colors"
              onClick={() => onSetAlert(signal)}
            >
              设预警
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

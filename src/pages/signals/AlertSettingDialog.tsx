import { useState } from 'react';
import type { Signal, AlertSetting } from '../../types';

interface AlertSettingDialogProps {
  open: boolean;
  signal: Signal;
  onClose: () => void;
  onConfirm: (setting: AlertSetting) => void;
}

const ALERT_METHODS = [
  { value: 'notification' as const, label: '站内通知' },
  { value: 'sms' as const, label: '短信提醒' },
  { value: 'wechat' as const, label: '微信推送' },
];

const ALERT_FREQUENCIES = [
  { value: 'once' as const, label: '仅一次' },
  { value: 'daily' as const, label: '每日一次' },
  { value: 'every' as const, label: '每次触发' },
];

export default function AlertSettingDialog({
  open,
  signal,
  onClose,
  onConfirm,
}: AlertSettingDialogProps) {
  const [stopLossPrice, setStopLossPrice] = useState<string>(
    signal.stop_loss_price ? String(signal.stop_loss_price) : ''
  );
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>(
    signal.take_profit_price ? String(signal.take_profit_price) : ''
  );
  const [alertMethod, setAlertMethod] = useState<AlertSetting['alert_method']>('notification');
  const [alertFrequency, setAlertFrequency] = useState<AlertSetting['alert_frequency']>('once');

  if (!open) return null;

  const handleConfirm = () => {
    const setting: AlertSetting = {
      stop_loss_price: Number(stopLossPrice) || 0,
      take_profit_price: Number(takeProfitPrice) || 0,
      alert_method: alertMethod,
      alert_frequency: alertFrequency,
    };
    onConfirm(setting);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[380px] rounded-lg border border-border p-5"
        style={{ background: 'var(--bg-panel, #1c1c1c)' }}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary text-sm font-semibold">预警设置</h3>
          <button
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* 股票信息 */}
        <div className="mb-4 px-3 py-2 rounded bg-bg-secondary border border-border">
          <span className="text-text-primary text-sm font-medium">{signal.stock_name}</span>
          <span className="text-text-muted text-xs ml-2">{signal.stock_code}</span>
          <span className="text-text-secondary text-xs ml-2">
            信号价: {signal.signal_price.toFixed(2)}
          </span>
        </div>

        {/* 止损价 */}
        <div className="mb-3">
          <label className="block text-text-secondary text-xs mb-1">止损价</label>
          <input
            type="number"
            value={stopLossPrice}
            onChange={(e) => setStopLossPrice(e.target.value)}
            placeholder="请输入止损价"
            className="w-full bg-bg-secondary border border-border text-text-primary text-sm px-3 py-1.5 rounded focus:outline-none focus:border-orange/50"
            step="0.01"
          />
        </div>

        {/* 止盈价 */}
        <div className="mb-3">
          <label className="block text-text-secondary text-xs mb-1">止盈价</label>
          <input
            type="number"
            value={takeProfitPrice}
            onChange={(e) => setTakeProfitPrice(e.target.value)}
            placeholder="请输入止盈价"
            className="w-full bg-bg-secondary border border-border text-text-primary text-sm px-3 py-1.5 rounded focus:outline-none focus:border-orange/50"
            step="0.01"
          />
        </div>

        {/* 提醒方式 */}
        <div className="mb-3">
          <label className="block text-text-secondary text-xs mb-1">提醒方式</label>
          <div className="flex items-center gap-2">
            {ALERT_METHODS.map((method) => (
              <button
                key={method.value}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  alertMethod === method.value
                    ? 'bg-orange/15 text-orange border border-orange/30'
                    : 'bg-bg-secondary border border-border text-text-muted hover:text-text-secondary'
                }`}
                onClick={() => setAlertMethod(method.value)}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        {/* 提醒频率 */}
        <div className="mb-5">
          <label className="block text-text-secondary text-xs mb-1">提醒频率</label>
          <div className="flex items-center gap-2">
            {ALERT_FREQUENCIES.map((freq) => (
              <button
                key={freq.value}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  alertFrequency === freq.value
                    ? 'bg-orange/15 text-orange border border-orange/30'
                    : 'bg-bg-secondary border border-border text-text-muted hover:text-text-secondary'
                }`}
                onClick={() => setAlertFrequency(freq.value)}
              >
                {freq.label}
              </button>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2">
          <button
            className="px-4 py-1.5 rounded text-xs bg-bg-secondary border border-border text-text-muted hover:text-text-primary transition-colors"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="px-4 py-1.5 rounded text-xs bg-orange text-black font-medium hover:bg-orange/80 transition-colors"
            onClick={handleConfirm}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

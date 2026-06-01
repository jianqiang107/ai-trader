import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import type { AlertSetting } from '../../types';

const STOP_LOSS_OPTIONS = [
  { label: '-3%', value: -3 },
  { label: '-5%', value: -5 },
  { label: '-8%', value: -8 },
];

const TAKE_PROFIT_OPTIONS = [
  { label: '+5%', value: 5 },
  { label: '+10%', value: 10 },
  { label: '+15%', value: 15 },
];

const ALERT_METHOD_OPTIONS: { label: string; value: AlertSetting['alert_method'] }[] = [
  { label: '站内通知', value: 'notification' },
  { label: '短信', value: 'sms' },
  { label: '微信推送', value: 'wechat' },
];

const ALERT_FREQUENCY_OPTIONS: { label: string; value: AlertSetting['alert_frequency'] }[] = [
  { label: '仅首次', value: 'once' },
  { label: '每日一次', value: 'daily' },
  { label: '每次触及', value: 'every' },
];

interface AlertPreferenceDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 预警偏好设置弹窗。
 * 注意：AlertSetting 类型中 stop_loss_price / take_profit_price 在本弹窗中
 * 语义为百分比（如 -3 代表 -3%），mock 数据及 store 均按此约定处理。
 */
export default function AlertPreferenceDialog({ open, onClose }: AlertPreferenceDialogProps) {
  const user = useAuthStore((s) => s.user);
  const updateAlertSettings = useAuthStore((s) => s.updateAlertSettings);

  const [stopLossPct, setStopLossPct] = useState(-5);
  const [customStopLoss, setCustomStopLoss] = useState('');
  const [takeProfitPct, setTakeProfitPct] = useState(10);
  const [customTakeProfit, setCustomTakeProfit] = useState('');
  const [alertMethod, setAlertMethod] = useState<AlertSetting['alert_method']>('notification');
  const [alertFrequency, setAlertFrequency] = useState<AlertSetting['alert_frequency']>('once');
  const [saving, setSaving] = useState(false);

  /** 初始化表单 */
  useEffect(() => {
    if (open && user?.alert_settings) {
      const s = user.alert_settings;
      // stop_loss_price / take_profit_price 在本弹窗中作为百分比使用
      const sl = s.stop_loss_price;
      const tp = s.take_profit_price;
      setAlertMethod(s.alert_method);
      setAlertFrequency(s.alert_frequency);

      const isCustomStop = !STOP_LOSS_OPTIONS.some((o) => o.value === sl);
      if (isCustomStop && sl !== 0) {
        setCustomStopLoss(String(sl));
        setStopLossPct(0);
      } else {
        setStopLossPct(sl);
        setCustomStopLoss('');
      }

      const isCustomTake = !TAKE_PROFIT_OPTIONS.some((o) => o.value === tp);
      if (isCustomTake && tp !== 0) {
        setCustomTakeProfit(String(tp));
        setTakeProfitPct(0);
      } else {
        setTakeProfitPct(tp);
        setCustomTakeProfit('');
      }
    }
  }, [open, user]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    const finalStopLoss = stopLossPct === 0 && customStopLoss
      ? Number(customStopLoss)
      : stopLossPct;
    const finalTakeProfit = takeProfitPct === 0 && customTakeProfit
      ? Number(customTakeProfit)
      : takeProfitPct;

    try {
      await updateAlertSettings({
        stop_loss_price: finalStopLoss,
        take_profit_price: finalTakeProfit,
        alert_method: alertMethod,
        alert_frequency: alertFrequency,
      });
      onClose();
    } catch {
      console.error('Failed to save alert settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[420px] rounded-lg border border-border flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-panel, #1c1c1c)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h3 className="text-text-primary text-sm font-semibold">预警偏好设置</h3>
          <button
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          {/* 默认止损百分比 */}
          <div>
            <label className="block text-text-secondary text-xs mb-2">默认止损百分比</label>
            <div className="flex items-center gap-2 flex-wrap">
              {STOP_LOSS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    stopLossPct === opt.value
                      ? 'bg-rise/15 text-rise border border-rise/30'
                      : 'bg-bg-secondary border border-border text-text-muted hover:text-text-secondary'
                  }`}
                  onClick={() => { setStopLossPct(opt.value); setCustomStopLoss(''); }}
                >
                  {opt.label}
                </button>
              ))}
              <div className="flex items-center gap-1">
                <button
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    stopLossPct === 0 && customStopLoss
                      ? 'bg-rise/15 text-rise border border-rise/30'
                      : 'bg-bg-secondary border border-border text-text-muted hover:text-text-secondary'
                  }`}
                  onClick={() => setStopLossPct(0)}
                >
                  自定义
                </button>
                {stopLossPct === 0 && (
                  <input
                    type="number"
                    value={customStopLoss}
                    onChange={(e) => setCustomStopLoss(e.target.value)}
                    placeholder="-3"
                    className="w-16 bg-bg-secondary border border-border text-text-primary text-xs px-2 py-1.5 rounded focus:outline-none focus:border-orange/50"
                  />
                )}
                {stopLossPct === 0 && <span className="text-text-muted text-xs">%</span>}
              </div>
            </div>
          </div>

          {/* 默认止盈百分比 */}
          <div>
            <label className="block text-text-secondary text-xs mb-2">默认止盈百分比</label>
            <div className="flex items-center gap-2 flex-wrap">
              {TAKE_PROFIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    takeProfitPct === opt.value
                      ? 'bg-rise/15 text-rise border border-rise/30'
                      : 'bg-bg-secondary border border-border text-text-muted hover:text-text-secondary'
                  }`}
                  onClick={() => { setTakeProfitPct(opt.value); setCustomTakeProfit(''); }}
                >
                  {opt.label}
                </button>
              ))}
              <div className="flex items-center gap-1">
                <button
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    takeProfitPct === 0 && customTakeProfit
                      ? 'bg-rise/15 text-rise border border-rise/30'
                      : 'bg-bg-secondary border border-border text-text-muted hover:text-text-secondary'
                  }`}
                  onClick={() => setTakeProfitPct(0)}
                >
                  自定义
                </button>
                {takeProfitPct === 0 && (
                  <input
                    type="number"
                    value={customTakeProfit}
                    onChange={(e) => setCustomTakeProfit(e.target.value)}
                    placeholder="5"
                    className="w-16 bg-bg-secondary border border-border text-text-primary text-xs px-2 py-1.5 rounded focus:outline-none focus:border-orange/50"
                  />
                )}
                {takeProfitPct === 0 && <span className="text-text-muted text-xs">%</span>}
              </div>
            </div>
          </div>

          {/* 提醒方式 */}
          <div>
            <label className="block text-text-secondary text-xs mb-2">提醒方式</label>
            <div className="flex items-center gap-2">
              {ALERT_METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    alertMethod === opt.value
                      ? 'bg-orange/15 text-orange border border-orange/30'
                      : 'bg-bg-secondary border border-border text-text-muted hover:text-text-secondary'
                  }`}
                  onClick={() => setAlertMethod(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 提醒频率 */}
          <div>
            <label className="block text-text-secondary text-xs mb-2">提醒频率</label>
            <div className="flex items-center gap-2">
              {ALERT_FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    alertFrequency === opt.value
                      ? 'bg-orange/15 text-orange border border-orange/30'
                      : 'bg-bg-secondary border border-border text-text-muted hover:text-text-secondary'
                  }`}
                  onClick={() => setAlertFrequency(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-border shrink-0">
          <button
            className="px-4 py-1.5 rounded text-xs bg-bg-secondary border border-border text-text-secondary hover:text-text-primary transition-colors"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="px-4 py-1.5 rounded text-xs bg-orange text-black font-medium hover:bg-orange/80 transition-colors disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

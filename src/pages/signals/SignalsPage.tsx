import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSignalStore } from '../../stores/useSignalStore';
import SignalCard from './SignalCard';
import StatsCards from './StatsCards';
import AlertSettingDialog from './AlertSettingDialog';
import type { Signal, AlertSetting } from '../../types';
import { formatTime } from '../../utils/format';

const TYPE_TABS = [
  { value: 'all', label: '全部' },
  { value: 'BUY', label: '买入' },
  { value: 'SELL', label: '卖出' },
] as const;

const PERIOD_TABS = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
] as const;

export default function SignalsPage() {
  const liveSignals = useSignalStore((s) => s.liveSignals);
  const liveStats = useSignalStore((s) => s.liveStats);
  const liveFilter = useSignalStore((s) => s.liveFilter);
  const fetchLiveSignals = useSignalStore((s) => s.fetchLiveSignals);
  const setLiveFilter = useSignalStore((s) => s.setLiveFilter);
  const acknowledgeSignal = useSignalStore((s) => s.acknowledgeSignal);
  const setAlert = useSignalStore((s) => s.setAlert);

  const [search, setSearch] = useState('');
  const [onlyHolding, setOnlyHolding] = useState(false);
  const [onlyAlerting, setOnlyAlerting] = useState(false);
  const [alertSignal, setAlertSignal] = useState<Signal | null>(null);

  useEffect(() => {
    fetchLiveSignals();
  }, [fetchLiveSignals]);

  const filteredSignals = useMemo(() => {
    let result = liveSignals;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.stock_code.toLowerCase().includes(q) || s.stock_name.includes(search)
      );
    }
    if (onlyHolding) {
      result = result.filter((s) => s.status === 'executed');
    }
    if (onlyAlerting) {
      result = result.filter((s) => s.alert_status === 'warning' || s.alert_status === 'stop_loss');
    }
    return result;
  }, [liveSignals, search, onlyHolding, onlyAlerting]);

  const handleTypeChange = (type: 'all' | 'BUY' | 'SELL') => {
    setLiveFilter({ type });
  };

  const handlePeriodChange = (period: 'today' | 'week' | 'month') => {
    setLiveFilter({ period });
    fetchLiveSignals();
  };

  const handleExecute = async (id: string) => {
    await acknowledgeSignal(id, 'execute');
  };

  const handleIgnore = async (id: string) => {
    await acknowledgeSignal(id, 'ignore');
  };

  const handleSetAlert = async (id: string, setting: AlertSetting) => {
    await setAlert(id, setting);
    setAlertSignal(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 顶部筛选栏 */}
      <div className="h-9 bg-[#141414] border-b border-border flex items-center px-3 gap-3 shrink-0">
        {/* 信号类型 */}
        <div className="flex items-center gap-0.5">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                liveFilter.type === tab.value
                  ? 'bg-orange/15 text-orange border border-orange/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => handleTypeChange(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* 时间段 */}
        <div className="flex items-center gap-0.5">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                liveFilter.period === tab.value
                  ? 'bg-orange/15 text-orange border border-orange/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => handlePeriodChange(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* 搜索 */}
        <input
          type="text"
          placeholder="🔍 搜索股票..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-panel border border-border-light text-text-primary px-2 py-0.5 rounded text-xs w-[120px]"
        />

        {/* 只看持仓 */}
        <button
          className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
            onlyHolding
              ? 'bg-blue/15 text-blue border border-blue/30'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          onClick={() => setOnlyHolding(!onlyHolding)}
        >
          只看持仓
        </button>

        {/* 只看预警 */}
        <button
          className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
            onlyAlerting
              ? 'bg-rise/15 text-rise border border-rise/30'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          onClick={() => setOnlyAlerting(!onlyAlerting)}
        >
          只看预警
        </button>

        <span className="flex-1" />
        <span className="text-text-muted text-[11px]">{filteredSignals.length} 条信号</span>
      </div>

      {/* 统计卡片 */}
      <div className="shrink-0">
        <StatsCards stats={liveStats} />
      </div>

      {/* 信号卡片列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredSignals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onExecute={handleExecute}
              onIgnore={handleIgnore}
              onSetAlert={(s) => setAlertSignal(s)}
              onViewDetail={() => {
                /* Will be handled by StockDetailModal in App level */
              }}
              onAddToWatchlist={() => {
                /* Will be handled by WatchlistStore */
              }}
            />
          ))}
        </AnimatePresence>

        {filteredSignals.length === 0 && (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">
            暂无匹配信号
          </div>
        )}
      </div>

      {/* 预警设置弹窗 */}
      {alertSignal && (
        <AlertSettingDialog
          open={!!alertSignal}
          signal={alertSignal}
          onClose={() => setAlertSignal(null)}
          onConfirm={(setting) => handleSetAlert(alertSignal.id, setting)}
        />
      )}
    </div>
  );
}

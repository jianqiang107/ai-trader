import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSignalStore } from '../../stores/useSignalStore';
import { useWatchlistStore } from '../../stores/useWatchlistStore';
import SignalCard from './SignalCard';
import StatsCards from './StatsCards';
import AlertSettingDialog from './AlertSettingDialog';
import StockDetailDialog from '../../components/common/StockDetailDialog';
import type { Signal, AlertSetting } from '../../types';

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
  const liveLoading = useSignalStore((s) => s.liveLoading);
  const liveError = useSignalStore((s) => s.liveError);
  const fetchLiveSignals = useSignalStore((s) => s.fetchLiveSignals);
  const setLiveFilter = useSignalStore((s) => s.setLiveFilter);
  const acknowledgeSignal = useSignalStore((s) => s.acknowledgeSignal);
  const setAlert = useSignalStore((s) => s.setAlert);
  const addToWatchlist = useWatchlistStore((s) => s.addToWatchlist);

  const [search, setSearch] = useState('');
  const [onlyHolding, setOnlyHolding] = useState(false);
  const [onlyAlerting, setOnlyAlerting] = useState(false);
  const [alertSignal, setAlertSignal] = useState<Signal | null>(null);
  const [detailSignal, setDetailSignal] = useState<Signal | null>(null);
  const [message, setMessage] = useState('');

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
  };

  const handleExecute = async (id: string) => {
    try {
      await acknowledgeSignal(id, 'execute');
      setMessage('已标记执行，后续将跟踪浮动盈亏和预警线。');
    } catch {
      setMessage('执行标记失败，请稍后重试。');
    }
  };

  const handleIgnore = async (id: string) => {
    try {
      await acknowledgeSignal(id, 'ignore');
      setMessage('已忽略该信号。');
    } catch {
      setMessage('忽略信号失败，请稍后重试。');
    }
  };

  const handleSetAlert = async (id: string, setting: AlertSetting) => {
    try {
      await setAlert(id, setting);
      setAlertSignal(null);
      setMessage('预警参数已更新。');
    } catch {
      setMessage('预警参数更新失败，请稍后重试。');
    }
  };

  const handleAddToWatchlist = async (signal: Signal) => {
    try {
      await addToWatchlist(signal.stock_code);
      setMessage(`${signal.stock_name} 已加入自选。`);
    } catch {
      setMessage('加入自选失败，请先确认已登录或稍后重试。');
    }
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
        {message && (
          <span className="text-orange text-[11px] max-w-[280px] truncate">{message}</span>
        )}
        <span className="text-text-muted text-[11px]">{filteredSignals.length} 条信号</span>
      </div>

      {/* 统计卡片 */}
      <div className="shrink-0">
        <StatsCards stats={liveStats} />
      </div>

      {/* 信号卡片列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {liveLoading ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">
            正在加载实盘信号...
          </div>
        ) : liveError ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-sm">
            <div className="text-rise">{liveError}</div>
            <button
              className="px-3 py-1 rounded text-xs bg-orange/15 border border-orange/30 text-orange hover:bg-orange hover:text-black transition-colors"
              onClick={() => fetchLiveSignals()}
            >
              重新加载
            </button>
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {filteredSignals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onExecute={handleExecute}
                  onIgnore={handleIgnore}
                  onSetAlert={(s) => setAlertSignal(s)}
                  onViewDetail={setDetailSignal}
                  onAddToWatchlist={handleAddToWatchlist}
                />
              ))}
            </AnimatePresence>

            {filteredSignals.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-text-muted text-sm gap-2">
                <div>当前筛选条件下暂无实盘信号</div>
                <button
                  className="px-3 py-1 rounded text-xs bg-bg-secondary border border-border text-text-secondary hover:text-orange transition-colors"
                  onClick={() => {
                    setSearch('');
                    setOnlyHolding(false);
                    setOnlyAlerting(false);
                    setLiveFilter({ type: 'all', period: 'today' });
                  }}
                >
                  重置筛选
                </button>
              </div>
            )}
          </>
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

      {detailSignal && (
        <StockDetailDialog
          open={!!detailSignal}
          stockCode={detailSignal.stock_code}
          stockName={detailSignal.stock_name}
          signalTags={[detailSignal.mode]}
          onClose={() => setDetailSignal(null)}
        />
      )}
    </div>
  );
}

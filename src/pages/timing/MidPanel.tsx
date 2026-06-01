import { useState, useEffect } from 'react';
import { useMarketStore } from '../../stores/useMarketStore';
import { useSignalStore } from '../../stores/useSignalStore';
import MainlineTab from './MainlineTab';
import EtfTab from './EtfTab';
import StockTab from './StockTab';
import SummaryTab from './SummaryTab';

type SubTab = 'mainline' | 'etf' | 'stock' | 'summary';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'mainline', label: '主线模式' },
  { key: 'etf', label: 'ETF模式' },
  { key: 'stock', label: '个股模式' },
  { key: 'summary', label: '个股汇总' },
];

export default function MidPanel() {
  const [activeTab, setActiveTab] = useState<SubTab>('summary');
  const selectedDate = useMarketStore((s) => s.selectedDate);
  const fetchTimingSignals = useSignalStore((s) => s.fetchTimingSignals);

  useEffect(() => {
    fetchTimingSignals(selectedDate, activeTab === 'mainline' ? '主线' : activeTab === 'etf' ? 'ETF' : activeTab === 'stock' ? '个股' : '汇总');
  }, [selectedDate, activeTab, fetchTimingSignals]);

  const handleRefresh = () => {
    fetchTimingSignals(selectedDate, activeTab === 'mainline' ? '主线' : activeTab === 'etf' ? 'ETF' : activeTab === 'stock' ? '个股' : '汇总');
  };

  return (
    <div className="flex-1 bg-bg-primary border-r border-border flex flex-col overflow-hidden">
      {/* Sub Tab栏 */}
      <div className="h-8 bg-[#141414] border-b border-border flex items-center px-2.5 gap-0.5 shrink-0">
        {SUB_TABS.map((tab) => (
          <div
            key={tab.key}
            className={`px-3 py-1 cursor-pointer text-xs rounded transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-orange bg-orange/10'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </div>
        ))}
        <div className="flex-1" />
        <div
          className="px-2.5 py-0.5 bg-blue/10 border border-blue text-blue rounded text-[11px] cursor-pointer hover:bg-blue hover:text-black transition-all"
          onClick={handleRefresh}
        >
          ↺ 刷新
        </div>
      </div>

      {/* Sub Tab内容 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'mainline' && <MainlineTab />}
        {activeTab === 'etf' && <EtfTab />}
        {activeTab === 'stock' && <StockTab />}
        {activeTab === 'summary' && <SummaryTab />}
      </div>
    </div>
  );
}

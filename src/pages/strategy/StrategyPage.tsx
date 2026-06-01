import { useState, useEffect, useMemo } from 'react';
import { useStrategyStore } from '../../stores/useStrategyStore';
import StrategyCard from './StrategyCard';
import StrategyDetailDialog from './StrategyDetailDialog';
import EmptyState from '../../components/common/EmptyState';
import type { StrategyType } from '../../types';

const TYPE_TABS: { value: StrategyType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '低吸', label: '低吸' },
  { value: '趋势', label: '趋势' },
  { value: '突破', label: '突破' },
  { value: '均值回归', label: '均值回归' },
];

const SORT_OPTIONS = [
  { value: 'total_return', label: '收益率' },
  { value: 'win_rate', label: '胜率' },
  { value: 'sharpe_ratio', label: '夏普' },
];

export default function StrategyPage() {
  const strategies = useStrategyStore((s) => s.strategies);
  const fetchStrategies = useStrategyStore((s) => s.fetchStrategies);
  const subscribeStrategy = useStrategyStore((s) => s.subscribeStrategy);
  const fetchStrategyDetail = useStrategyStore((s) => s.fetchStrategyDetail);

  const [activeType, setActiveType] = useState<StrategyType | 'all'>('all');
  const [sortBy, setSortBy] = useState('total_return');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    fetchStrategies(activeType === 'all' ? undefined : activeType, sortBy);
  }, [activeType, sortBy, fetchStrategies]);

  const handleSubscribe = async (id: string) => {
    await subscribeStrategy(id);
  };

  const handleViewDetail = async (id: string) => {
    await fetchStrategyDetail(id);
    setDetailId(id);
  };

  const sortedStrategies = useMemo(() => {
    const list = [...strategies];
    list.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a] as number;
      const bVal = b[sortBy as keyof typeof b] as number;
      return bVal - aVal;
    });
    return list;
  }, [strategies, sortBy]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 筛选栏 */}
      <div className="h-9 bg-[#141414] border-b border-border flex items-center px-3 gap-3 shrink-0">
        {/* 策略类型 */}
        <div className="flex items-center gap-0.5">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                activeType === tab.value
                  ? 'bg-orange/15 text-orange border border-orange/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => setActiveType(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* 排序 */}
        <div className="flex items-center gap-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                sortBy === opt.value
                  ? 'bg-blue/15 text-blue border border-blue/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => setSortBy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="flex-1" />
        <span className="text-text-muted text-[11px]">{sortedStrategies.length} 个策略</span>
      </div>

      {/* 策略网格 */}
      <div className="flex-1 overflow-y-auto p-3">
        {sortedStrategies.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {sortedStrategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onSubscribe={handleSubscribe}
                onViewDetail={handleViewDetail}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="暂无策略" description="未找到匹配的策略" />
        )}
      </div>

      {/* 策略详情弹窗 */}
      {detailId && (
        <StrategyDetailDialog
          open={!!detailId}
          strategyId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useStrategyStore } from '../../stores/useStrategyStore';
import PerformanceChart from '../../components/charts/PerformanceChart';
import DataTable from '../../components/common/DataTable';
import { formatChangePct, formatPrice } from '../../utils/format';
import type { StrategyType, TradeDetail } from '../../types';

const STRATEGY_OPTIONS = [
  { value: 'strat_low1', label: '低吸策略' },
  { value: 'strat_trend1', label: '趋势策略' },
  { value: 'strat_break1', label: '突破策略' },
  { value: 'strat_mean1', label: '均值回归' },
];

export default function PerformancePage() {
  const [selectedStrategy, setSelectedStrategy] = useState('strat_low1');
  const [startDate, setStartDate] = useState('2026-03-01');
  const [endDate, setEndDate] = useState('2026-06-01');
  const [search, setSearch] = useState('');

  const strategyPerformance = useStrategyStore((s) => s.strategyPerformance);
  const fetchPerformance = useStrategyStore((s) => s.fetchPerformance);

  useEffect(() => {
    fetchPerformance(selectedStrategy, startDate, endDate);
  }, [selectedStrategy, startDate, endDate, fetchPerformance]);

  const handleQuery = () => {
    fetchPerformance(selectedStrategy, startDate, endDate);
  };

  const filteredTrades = (strategyPerformance?.trades || []).filter(
    (t) => !search || t.stock_code.includes(search) || t.stock_name.includes(search)
  );

  const tradeColumns = [
    { key: 'index', title: '序号', width: 40, render: (_: unknown, __: unknown, i: number) => <span className="text-text-muted">{i + 1}</span> },
    { key: 'stock_code', title: '代码', width: 65, render: (v: unknown) => <span className="text-blue">{v as string}</span> },
    { key: 'stock_name', title: '名称', width: 65, render: (v: unknown) => <span className="text-text-primary">{v as string}</span> },
    { key: 'buy_date', title: '买入时间', width: 85, render: (v: unknown) => <span className="text-text-muted">{v as string}</span>, sorter: (a: Record<string, unknown>, b: Record<string, unknown>) => (a as unknown as TradeDetail).buy_date.localeCompare((b as unknown as TradeDetail).buy_date) },
    { key: 'buy_price', title: '买入价格', width: 65, render: (v: unknown) => formatPrice(v as number) },
    { key: 'position_pct', title: '买入仓位', width: 65, render: (v: unknown) => <span className="text-orange">{v as number}%</span> },
    { key: 'sell_date', title: '卖出时间', width: 85, render: (v: unknown) => <span className="text-text-muted">{v as string}</span> },
    { key: 'sell_price', title: '卖出价格', width: 65, render: (v: unknown) => formatPrice(v as number) },
    { key: 'pnl_pct', title: '次数收益', width: 65, render: (v: unknown) => {
      const val = v as number;
      return <span className={`font-semibold ${val >= 0 ? 'rise' : 'fall'}`}>{formatChangePct(val)}</span>;
    }},
    { key: 'sector', title: '入选板块', width: 65, render: (v: unknown) => <span className="px-1 py-0.5 rounded text-[10px] bg-fall/10 text-fall border border-fall/30">{v as string}</span> },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 顶部操作栏 */}
      <div className="h-9 bg-[#141414] border-b border-border flex items-center px-3 gap-3 shrink-0">
        <label className="text-text-secondary text-xs">策略选择:</label>
        <select
          value={selectedStrategy}
          onChange={(e) => setSelectedStrategy(e.target.value)}
          className="bg-bg-panel border border-border-light text-text-primary px-2 py-0.5 rounded text-xs"
        >
          {STRATEGY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <label className="text-text-secondary text-xs">起始:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-bg-panel border border-border-light text-text-primary px-2 py-0.5 rounded text-[11px] w-[100px]"
        />

        <label className="text-text-secondary text-xs">结束:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-bg-panel border border-border-light text-text-primary px-2 py-0.5 rounded text-[11px] w-[100px]"
        />

        <input
          type="text"
          placeholder="🔍 搜索股票..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-panel border border-border-light text-text-primary px-2 py-0.5 rounded text-xs w-[130px]"
        />

        <div
          className="px-2.5 py-0.5 bg-orange/15 border border-orange text-orange rounded text-[11px] cursor-pointer hover:bg-orange hover:text-black transition-all"
          onClick={handleQuery}
        >
          查询
        </div>

        <span className="flex-1" />

        <span className="text-text-muted text-xs">策略总收益:</span>
        <span className="rise font-bold text-sm">
          {strategyPerformance ? formatChangePct(strategyPerformance.total_return) : '-'}
        </span>
        <span className="text-text-muted text-xs ml-2">最大回撤:</span>
        <span className="fall font-bold">
          {strategyPerformance ? formatChangePct(strategyPerformance.max_drawdown) : '-'}
        </span>
      </div>

      {/* 图表 + 表格 */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="shrink-0" style={{ height: 260 }}>
          <PerformanceChart data={strategyPerformance} height={260} />
        </div>
        <div className="flex-1 overflow-hidden">
          <DataTable
            columns={tradeColumns}
            data={filteredTrades as unknown as Record<string, unknown>[]}
            rowKey="id"
          />
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useStrategyStore } from '../../stores/useStrategyStore';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import SignalTag from '../../components/common/SignalTag';
import type { Strategy, StrategyType, FactorState } from '../../types';
import { formatChangePct } from '../../utils/format';

interface StrategyDetailDialogProps {
  open: boolean;
  strategyId: string;
  onClose: () => void;
}

function strategyToTagType(type: StrategyType): '低吸' | '趋势' | '突破' | '均值回归' {
  return type as '低吸' | '趋势' | '突破' | '均值回归';
}

/** 因子状态颜色 */
function getFactorStatusColor(status: FactorState['status']): string {
  switch (status) {
    case 'danger':
      return '#e84040';
    case 'warning':
      return '#ffcc00';
    case 'normal':
    default:
      return '#00c0a0';
  }
}

export default function StrategyDetailDialog({
  open,
  strategyId,
  onClose,
}: StrategyDetailDialogProps) {
  const currentStrategy = useStrategyStore((s) => s.currentStrategy);
  const factorStates = useStrategyStore((s) => s.factorStates);
  const strategyPerformance = useStrategyStore((s) => s.strategyPerformance);
  const fetchStrategyDetail = useStrategyStore((s) => s.fetchStrategyDetail);
  const fetchPerformance = useStrategyStore((s) => s.fetchPerformance);

  const { chartRef: perfChartRef, chartInstance: perfChartInstance } = useECharts();
  const { chartRef: radarChartRef, chartInstance: radarChartInstance } = useECharts();

  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'factors'>('overview');

  useEffect(() => {
    if (open && strategyId) {
      fetchStrategyDetail(strategyId);
      fetchPerformance(strategyId, '2026-01-01', '2026-06-01');
    }
  }, [open, strategyId, fetchStrategyDetail, fetchPerformance]);

  /** 绩效曲线图 */
  useEffect(() => {
    if (!perfChartInstance.current || !strategyPerformance) return;
    const dates = strategyPerformance.dates;
    setChartOption(perfChartInstance.current, {
      tooltip: { trigger: 'axis', backgroundColor: '#1c1c1c', borderColor: '#333', textStyle: { color: '#e0e0e0', fontSize: 11 } },
      legend: { data: ['策略', '基准'], textStyle: { color: '#aaa', fontSize: 10 }, top: 0 },
      grid: { left: 40, right: 10, top: 25, bottom: 25 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#666', fontSize: 9 }, axisLine: { lineStyle: { color: '#2a2a2a' } } },
      yAxis: { type: 'value', axisLabel: { color: '#666', fontSize: 9 }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
      series: [
        { name: '策略', type: 'line', data: strategyPerformance.strategy_values, lineStyle: { color: '#ff8c00', width: 1.5 }, itemStyle: { color: '#ff8c00' }, symbol: 'none', smooth: true },
        { name: '基准', type: 'line', data: strategyPerformance.benchmark_values, lineStyle: { color: '#4a9eff', width: 1 }, itemStyle: { color: '#4a9eff' }, symbol: 'none', smooth: true },
      ],
    });
  }, [strategyPerformance]);

  /** 因子雷达图 */
  useEffect(() => {
    if (!radarChartInstance.current || factorStates.length === 0) return;
    const indicators = factorStates.map((f) => ({ name: f.label, max: 100 }));
    setChartOption(radarChartInstance.current, {
      radar: {
        indicator: indicators,
        shape: 'polygon',
        radius: '65%',
        axisName: { color: '#aaa', fontSize: 10 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
        splitLine: { lineStyle: { color: '#2a2a2a' } },
        axisLine: { lineStyle: { color: '#2a2a2a' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: factorStates.map((f) => f.value),
              areaStyle: { color: 'rgba(255,140,0,0.2)' },
              lineStyle: { color: '#ff8c00', width: 1.5 },
              itemStyle: { color: '#ff8c00' },
              symbol: 'circle',
              symbolSize: 4,
            },
          ],
        },
      ],
    });
  }, [factorStates]);

  if (!open || !currentStrategy) return null;

  const strategy: Strategy = currentStrategy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[720px] max-h-[80vh] rounded-lg border border-border flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-panel, #1c1c1c)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-text-primary text-base font-semibold">{strategy.name}</h3>
            <SignalTag tag={strategyToTagType(strategy.type)} />
          </div>
          <button
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Tab切换 */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-border shrink-0">
          {(['overview', 'performance', 'factors'] as const).map((tab) => (
            <button
              key={tab}
              className={`text-xs pb-1 border-b-2 transition-colors ${
                activeTab === tab
                  ? 'text-orange border-orange'
                  : 'text-text-muted border-transparent hover:text-text-secondary'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' ? '概览' : tab === 'performance' ? '绩效' : '因子分析'}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* 核心指标网格 */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '累计收益', value: formatChangePct(strategy.total_return), color: strategy.total_return >= 0 ? 'rise' : 'fall' },
                  { label: '胜率', value: `${(strategy.win_rate * 100).toFixed(1)}%`, color: 'text-text-primary' },
                  { label: '夏普比率', value: strategy.sharpe_ratio.toFixed(2), color: 'text-text-primary' },
                  { label: '最大回撤', value: formatChangePct(strategy.max_drawdown), color: 'rise' },
                  { label: '索提诺比率', value: strategy.sortino_ratio.toFixed(2), color: 'text-text-primary' },
                  { label: '卡尔马比率', value: strategy.calmar_ratio.toFixed(2), color: 'text-text-primary' },
                  { label: '运行天数', value: `${strategy.running_days}天`, color: 'text-text-primary' },
                  { label: '信号数量', value: `${strategy.signal_count}`, color: 'text-text-primary' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-3 border border-border" style={{ background: 'var(--bg-card, #181818)' }}>
                    <div className="text-text-muted text-[10px] mb-1">{item.label}</div>
                    <div className={`text-sm font-semibold ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>
              {/* 策略描述 */}
              <div className="rounded-lg p-3 border border-border" style={{ background: 'var(--bg-card, #181818)' }}>
                <div className="text-text-muted text-[10px] mb-1">策略描述</div>
                <div className="text-text-secondary text-xs leading-relaxed">{strategy.description}</div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="h-[340px]">
              <div ref={perfChartRef as React.RefObject<HTMLDivElement>} className="w-full h-full" />
            </div>
          )}

          {activeTab === 'factors' && (
            <div className="space-y-4">
              {/* 雷达图 */}
              <div className="h-[280px]">
                <div ref={radarChartRef as React.RefObject<HTMLDivElement>} className="w-full h-full" />
              </div>
              {/* 因子列表 */}
              <div className="space-y-2">
                {factorStates.map((factor) => (
                  <div
                    key={factor.label}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border"
                    style={{ background: 'var(--bg-card, #181818)' }}
                  >
                    <span className="text-text-secondary text-xs w-16">{factor.label}</span>
                    <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${factor.value}%`,
                          background: getFactorStatusColor(factor.status),
                        }}
                      />
                    </div>
                    <span className="text-text-primary text-xs font-medium w-8 text-right">
                      {factor.value}
                    </span>
                    <span
                      className={`text-[10px] ${factor.change >= 0 ? 'rise' : 'fall'}`}
                    >
                      {factor.change >= 0 ? '+' : ''}{factor.change}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

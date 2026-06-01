import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Strategy } from '../../types';
import SignalTag from '../../components/common/SignalTag';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import { formatChangePct, formatPrice } from '../../utils/format';

interface StrategyCardProps {
  strategy: Strategy;
  onSubscribe: (id: string) => void;
  onViewDetail: (id: string) => void;
}

/** 策略类型映射到信号标签类型 */
function strategyToTagType(type: Strategy['type']): '低吸' | '趋势' | '突破' | '均值回归' {
  return type as '低吸' | '趋势' | '突破' | '均值回归';
}

/** 雷达图7维度指标名 */
const RADAR_INDICATORS = [
  { name: '估值优势', max: 100 },
  { name: '涨势动力', max: 100 },
  { name: '资金热度', max: 100 },
  { name: '反弹潜力', max: 100 },
  { name: '市场温度', max: 100 },
  { name: '震荡程度', max: 100 },
  { name: '突破强度', max: 100 },
];

export default function StrategyCard({ strategy, onSubscribe, onViewDetail }: StrategyCardProps) {
  const { chartRef, chartInstance } = useECharts();
  const containerRef = useRef<HTMLDivElement>(null);

  /** 基于策略指标生成伪雷达图数据 */
  const radarValues = [
    Math.min(100, Math.max(20, strategy.total_return * 3 + 30)),
    Math.min(100, Math.max(20, strategy.win_rate * 100)),
    Math.min(100, Math.max(20, strategy.sharpe_ratio * 20 + 40)),
    Math.min(100, Math.max(20, strategy.sortino_ratio * 15 + 35)),
    Math.min(100, Math.max(20, strategy.calmar_ratio * 15 + 30)),
    Math.min(100, Math.max(20, 100 - strategy.max_drawdown * 5)),
    Math.min(100, Math.max(20, strategy.signal_count * 2 + 20)),
  ];

  useEffect(() => {
    if (!chartInstance.current) return;
    setChartOption(chartInstance.current, {
      radar: {
        indicator: RADAR_INDICATORS,
        shape: 'polygon',
        radius: '65%',
        center: ['50%', '55%'],
        axisName: { color: '#666', fontSize: 8 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
        splitLine: { lineStyle: { color: '#2a2a2a' } },
        axisLine: { lineStyle: { color: '#2a2a2a' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: radarValues,
              areaStyle: { color: 'rgba(255,140,0,0.15)' },
              lineStyle: { color: '#ff8c00', width: 1.5 },
              itemStyle: { color: '#ff8c00' },
              symbol: 'circle',
              symbolSize: 3,
            },
          ],
        },
      ],
    });
  }, [radarValues.join(',')]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border border-border p-3 flex flex-col"
      style={{ background: 'var(--bg-card, #181818)' }}
    >
      {/* 顶部：策略名+类型标签 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-text-primary text-sm font-semibold truncate flex-1">
          {strategy.name}
        </span>
        <SignalTag tag={strategyToTagType(strategy.type)} />
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-[10px]">累计收益</span>
          <span className={`text-xs font-semibold ${strategy.total_return >= 0 ? 'rise' : 'fall'}`}>
            {formatChangePct(strategy.total_return)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-[10px]">胜率</span>
          <span className="text-text-primary text-xs font-semibold">
            {(strategy.win_rate * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-[10px]">夏普比率</span>
          <span className="text-text-primary text-xs font-semibold">
            {strategy.sharpe_ratio.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-[10px]">最大回撤</span>
          <span className="text-rise text-xs font-semibold">
            {formatChangePct(strategy.max_drawdown)}
          </span>
        </div>
      </div>

      {/* 因子雷达图 */}
      <div ref={containerRef} className="flex-1 min-h-[140px]">
        <div ref={chartRef as React.RefObject<HTMLDivElement>} className="w-full h-full min-h-[140px]" />
      </div>

      {/* 底部操作 */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <span className="text-text-muted text-[10px]">
          运行 {strategy.running_days} 天 · {strategy.signal_count} 信号
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className="px-2 py-0.5 bg-bg-secondary border border-border text-text-secondary rounded text-[10px] hover:text-blue transition-colors"
            onClick={() => onViewDetail(strategy.id)}
          >
            详情
          </button>
          {strategy.is_subscribed ? (
            <span className="px-2 py-0.5 text-fall text-[10px]">已订阅</span>
          ) : (
            <button
              className="px-2 py-0.5 bg-orange/15 border border-orange/30 text-orange rounded text-[10px] hover:bg-orange hover:text-black transition-colors"
              onClick={() => onSubscribe(strategy.id)}
            >
              订阅
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

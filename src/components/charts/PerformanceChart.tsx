import { useEffect, useMemo } from 'react';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import { darkTooltip, darkAxisLine, darkSplitLine, orangeAreaGradient, blueAreaGradient } from '../../utils/echarts-options';
import { COLORS } from '../../utils/constants';
import type { PerformanceData } from '../../types';

interface PerformanceChartProps {
  data: PerformanceData | null;
  height?: number;
  className?: string;
}

export default function PerformanceChart({ data, height = 260, className = '' }: PerformanceChartProps) {
  const { chartRef, chartInstance } = useECharts();

  const option = useMemo(() => {
    if (!data || data.dates.length === 0) return null;

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: { top: 16, left: 55, right: 16, bottom: 32 },
      legend: {
        data: ['策略收益', '沪深300'],
        right: 16,
        top: 4,
        textStyle: { color: '#aaa', fontSize: 11 },
      },
      xAxis: {
        type: 'category' as const,
        data: data.dates,
        axisLabel: { color: '#666', fontSize: 10, interval: 9 },
        axisLine: darkAxisLine,
        splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' as const } },
      },
      yAxis: {
        type: 'value',
        name: '收益率(%)',
        nameTextStyle: { color: '#666', fontSize: 10 },
        splitLine: darkSplitLine,
        axisLabel: { color: '#666', fontSize: 10, formatter: (v: number) => v + '%' },
      },
      tooltip: {
        ...darkTooltip,
        formatter: (params: Record<string, unknown>[]) => {
          return `${(params[0] as Record<string, unknown>).axisValue}<br/>${params
            .map(
              (p) =>
                `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${(p.value as number) > 0 ? '+' : ''}${p.value}%</b>`
            )
            .join('<br/>')}`;
        },
      },
      series: [
        {
          name: '策略收益',
          type: 'line',
          data: data.strategy_values,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: COLORS.orange, width: 2 },
          areaStyle: orangeAreaGradient(),
        },
        {
          name: '沪深300',
          type: 'line',
          data: data.benchmark_values,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: COLORS.blue, width: 2 },
          areaStyle: blueAreaGradient(),
        },
      ],
    };
  }, [data]);

  useEffect(() => {
    if (option) {
      setChartOption(chartInstance.current, option);
    }
  }, [option, chartInstance]);

  return <div ref={chartRef} className={className} style={{ height, width: '100%' }} />;
}

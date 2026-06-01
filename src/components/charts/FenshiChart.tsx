import { useEffect, useMemo } from 'react';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import { darkTooltip, darkAxisLine, darkSplitLine, riseAreaGradient } from '../../utils/echarts-options';
import { COLORS } from '../../utils/constants';
import type { FenshiData } from '../../types';

interface FenshiChartProps {
  data: FenshiData[];
  height?: number;
  className?: string;
}

export default function FenshiChart({ data, height = 140, className = '' }: FenshiChartProps) {
  const { chartRef, chartInstance } = useECharts();

  const option = useMemo(() => {
    if (data.length === 0) return null;

    const times = data.map((d) => d.time);
    const prices = data.map((d) => d.price);
    const avgs = data.map((d) => d.avg_price);

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: { top: 6, left: 45, right: 6, bottom: 18 },
      xAxis: {
        type: 'category' as const,
        data: times,
        axisLabel: { color: '#555', fontSize: 9, interval: 59 },
        axisLine: darkAxisLine,
        splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' as const } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitLine: darkSplitLine,
        axisLabel: { color: '#555', fontSize: 9 },
      },
      series: [
        {
          type: 'line',
          data: prices,
          smooth: false,
          symbol: 'none',
          lineStyle: { color: COLORS.rise, width: 1.5 },
          areaStyle: riseAreaGradient(),
        },
        {
          type: 'line',
          data: avgs,
          smooth: false,
          symbol: 'none',
          lineStyle: { color: COLORS.orange, width: 1, type: 'dashed' as const },
        },
      ],
      tooltip: darkTooltip,
    };
  }, [data]);

  useEffect(() => {
    if (option) {
      setChartOption(chartInstance.current, option);
    }
  }, [option, chartInstance]);

  return <div ref={chartRef} className={className} style={{ height, width: '100%' }} />;
}

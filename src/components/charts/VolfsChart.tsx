import { useEffect, useMemo } from 'react';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import { darkTooltip, darkAxisLine, darkSplitLine } from '../../utils/echarts-options';
import { COLORS } from '../../utils/constants';
import type { VolfsData } from '../../types';

interface VolfsChartProps {
  data: VolfsData[];
  height?: number;
  className?: string;
}

export default function VolfsChart({ data, height = 100, className = '' }: VolfsChartProps) {
  const { chartRef, chartInstance } = useECharts();

  const option = useMemo(() => {
    if (data.length === 0) return null;

    const categories = data.map((d) => d.date);
    const values = data.map((d) => d.vol_value);
    const colors = data.map((d) => {
      if (d.vol_signal === 'bullish') return COLORS.rise;
      if (d.vol_signal === 'neutral') return COLORS.orange;
      return COLORS.fall;
    });

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: { top: 6, left: 45, right: 6, bottom: 18 },
      xAxis: {
        type: 'category' as const,
        data: categories,
        axisLabel: { show: false },
        axisLine: darkAxisLine,
      },
      yAxis: {
        type: 'value',
        splitLine: darkSplitLine,
        axisLabel: { color: '#555', fontSize: 8 },
      },
      series: [
        {
          type: 'bar',
          data: values,
          barWidth: '100%',
          itemStyle: {
            color: (params: { dataIndex: number }) => colors[params.dataIndex],
          },
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

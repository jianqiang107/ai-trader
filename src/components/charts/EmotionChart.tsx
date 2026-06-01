import { useEffect, useMemo } from 'react';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import { darkTooltip, darkAxisLine, darkSplitLine, emotionBlueGradient } from '../../utils/echarts-options';
import { COLORS } from '../../utils/constants';
import type { EmotionData, EmotionFlowData } from '../../types';

type EmotionMode = 'area' | 'bar';

interface EmotionChartProps {
  mode: EmotionMode;
  data1: EmotionData[];
  data2: EmotionFlowData[];
  height?: number;
  className?: string;
}

export default function EmotionChart({ mode, data1, data2, height = 120, className = '' }: EmotionChartProps) {
  const { chartRef, chartInstance } = useECharts();

  const option = useMemo(() => {
    if (mode === 'area') {
      // 情绪一号 - 面积图
      if (data1.length === 0) return null;
      const categories = data1.map((d) => d.date);
      const values = data1.map((d) => d.value);
      return {
        animation: false,
        backgroundColor: 'transparent',
        grid: { top: 8, left: 38, right: 6, bottom: 18 },
        xAxis: { type: 'category', data: categories, axisLabel: { show: false }, axisLine: darkAxisLine },
        yAxis: { type: 'value', min: 0, max: 100, splitLine: darkSplitLine, axisLabel: { color: '#555', fontSize: 8 } },
        series: [
          {
            type: 'line',
            data: values,
            smooth: true,
            symbol: 'none',
            lineStyle: { color: COLORS.blue, width: 1.5 },
            areaStyle: emotionBlueGradient(),
            markLine: {
              data: [{ type: 'average' as const, name: '均值', lineStyle: { color: COLORS.orange, type: 'dashed' as const, width: 1 } }],
              label: { color: COLORS.orange, fontSize: 9 },
            },
          },
        ],
        tooltip: darkTooltip,
      };
    } else {
      // 情绪二号 - 柱状图(资金流向)
      if (data2.length === 0) return null;
      const categories = data2.map((d) => d.date);
      const inflows = data2.map((d) => d.inflow);
      const outflows = data2.map((d) => d.outflow);
      return {
        animation: false,
        backgroundColor: 'transparent',
        grid: { top: 8, left: 38, right: 6, bottom: 18 },
        xAxis: { type: 'category', data: categories, axisLabel: { show: false }, axisLine: darkAxisLine },
        yAxis: { type: 'value', splitLine: darkSplitLine, axisLabel: { color: '#555', fontSize: 8 } },
        series: [
          {
            type: 'bar',
            name: '流入',
            data: inflows,
            barWidth: '40%',
            itemStyle: { color: COLORS.rise },
          },
          {
            type: 'bar',
            name: '流出',
            data: outflows,
            barWidth: '40%',
            itemStyle: { color: COLORS.fall },
          },
        ],
        tooltip: darkTooltip,
      };
    }
  }, [mode, data1, data2]);

  useEffect(() => {
    if (option) {
      setChartOption(chartInstance.current, option);
    }
  }, [option, chartInstance]);

  return <div ref={chartRef} className={className} style={{ height, width: '100%' }} />;
}

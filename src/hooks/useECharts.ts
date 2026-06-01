import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

interface UseEChartsReturn {
  chartRef: React.RefObject<HTMLDivElement>;
  chartInstance: React.MutableRefObject<echarts.ECharts | null>;
}

/** 统一管理ECharts实例生命周期的Hook */
export function useECharts(): UseEChartsReturn {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(el, undefined, { renderer: 'canvas' });
    }

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return { chartRef, chartInstance };
}

/** 安全设置图表选项 */
export function setChartOption(
  chart: echarts.ECharts | null,
  option: Record<string, unknown>
): void {
  if (!chart || chart.isDisposed()) return;
  chart.setOption(option as EChartsOption, { notMerge: false });
}

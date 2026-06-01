import { useEffect, useMemo } from 'react';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import { useKline, calcMA } from '../../hooks/useKline';
import { MA_COLORS, COLORS } from '../../utils/constants';
import { darkTooltip, candlestickStyle, darkAxisLine, darkSplitLine } from '../../utils/echarts-options';

interface KlineChartProps {
  code: string;
  height?: number;
  showVolume?: boolean;
  showMA?: boolean;
  showMark?: boolean;
  className?: string;
}

export default function KlineChart({
  code,
  height = 200,
  showVolume = true,
  showMA = true,
  showMark = false,
  className = '',
}: KlineChartProps) {
  const { chartRef, chartInstance } = useECharts();
  const { klineData } = useKline(code);

  const option = useMemo(() => {
    if (klineData.length === 0) return null;

    const dates = klineData.map((d) => d.date);
    const kdata = klineData.map((d) => [d.open, d.close, d.low, d.high]);
    const vols = klineData.map((d) => d.volume);
    const ma5 = calcMA(klineData, 5);
    const ma10 = calcMA(klineData, 10);
    const ma20 = calcMA(klineData, 20);
    const ma30 = calcMA(klineData, 30);

    // Find MA crossover "转" points
    const markPoints: Array<{ coord: [number, number]; value: string; itemStyle: { color: string } }> = [];
    if (showMark) {
      for (let i = 5; i < klineData.length; i++) {
        const ma5Val = ma5[i];
        const ma10Val = ma10[i];
        const ma5Prev = ma5[i - 1];
        const ma10Prev = ma10[i - 1];
        if (ma5Val !== null && ma10Val !== null && ma5Prev !== null && ma10Prev !== null) {
          if (ma5Prev < ma10Prev && ma5Val >= ma10Val) {
            markPoints.push({
              coord: [i, klineData[i].high + 0.05],
              value: '转',
              itemStyle: { color: COLORS.orange },
            });
          }
        }
      }
    }

    const series: Record<string, unknown>[] = [
      {
        type: 'candlestick',
        data: kdata,
        xAxisIndex: 0,
        yAxisIndex: 0,
        itemStyle: candlestickStyle,
        markPoint: markPoints.length > 0
          ? { symbol: 'circle', symbolSize: 20, data: markPoints, label: { color: '#000', fontSize: 9, fontWeight: 'bold' } }
          : undefined,
      },
    ];

    if (showMA) {
      series.push(
        { type: 'line', data: ma5, smooth: true, symbol: 'none', lineStyle: { color: MA_COLORS.ma5, width: 1 }, xAxisIndex: 0, yAxisIndex: 0, name: 'MA5' },
        { type: 'line', data: ma10, smooth: true, symbol: 'none', lineStyle: { color: MA_COLORS.ma10, width: 1 }, xAxisIndex: 0, yAxisIndex: 0, name: 'MA10' },
        { type: 'line', data: ma20, smooth: true, symbol: 'none', lineStyle: { color: MA_COLORS.ma20, width: 1 }, xAxisIndex: 0, yAxisIndex: 0, name: 'MA20' },
        { type: 'line', data: ma30, smooth: true, symbol: 'none', lineStyle: { color: MA_COLORS.ma30, width: 1 }, xAxisIndex: 0, yAxisIndex: 0, name: 'MA30' },
      );
    }

    if (showVolume) {
      series.push({
        type: 'bar',
        data: vols,
        xAxisIndex: 1,
        yAxisIndex: 1,
        itemStyle: {
          color: (params: { dataIndex: number }) => {
            const d = klineData[params.dataIndex];
            return d && d.close >= d.open ? COLORS.rise : COLORS.fall;
          },
        },
      });
    }

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: showVolume
        ? [
            { top: 8, left: 45, right: 6, bottom: 28, height: '70%' },
            { top: '80%', left: 45, right: 6, bottom: 4 },
          ]
        : { top: 8, left: 45, right: 6, bottom: 24 },
      xAxis: showVolume
        ? [
            { type: 'category' as const, data: dates, axisLabel: { show: false }, axisLine: darkAxisLine, splitLine: { show: false }, gridIndex: 0 },
            { type: 'category' as const, data: dates, axisLabel: { color: '#555', fontSize: 9 }, axisLine: darkAxisLine, gridIndex: 1 },
          ]
        : { type: 'category' as const, data: dates, axisLabel: { color: '#555', fontSize: 9 }, axisLine: darkAxisLine, splitLine: { show: false } },
      yAxis: showVolume
        ? [
            { type: 'value', scale: true, splitLine: darkSplitLine, axisLabel: { color: '#666', fontSize: 9 }, gridIndex: 0 },
            { type: 'value', scale: true, splitLine: { show: false }, axisLabel: { show: false }, gridIndex: 1 },
          ]
        : { type: 'value', scale: true, splitLine: darkSplitLine, axisLabel: { color: '#666', fontSize: 9 } },
      dataZoom: [{ type: 'inside', start: 60, end: 100 }],
      series,
      tooltip: {
        ...darkTooltip,
        axisPointer: { type: 'cross' },
        formatter: (params: Record<string, unknown>[]) => {
          const k = params.find((p) => p.seriesType === 'candlestick');
          if (!k) return '';
          const idx = k.dataIndex as number;
          const d = klineData[idx];
          if (!d) return '';
          return `<div style="font-size:10px">
            ${d.date}<br/>
            开: ${d.open}&nbsp;收: <span style="color:${d.close >= d.open ? COLORS.rise : COLORS.fall}">${d.close}</span><br/>
            高: ${d.high}&nbsp;低: ${d.low}
          </div>`;
        },
      },
    };
  }, [klineData, showVolume, showMA, showMark]);

  useEffect(() => {
    if (option) {
      setChartOption(chartInstance.current, option);
    }
  }, [option, chartInstance]);

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ height, width: '100%' }}
    />
  );
}

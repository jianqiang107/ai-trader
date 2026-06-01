import { useState, useEffect, useRef } from 'react';
import { useStockDetail } from '../../hooks/useStockDetail';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import SignalTag from '../../components/common/SignalTag';
import type { KLineData, SignalTagType } from '../../types';
import { formatPrice, formatChangePct, formatVolume, formatDate } from '../../utils/format';
import { MA_COLORS } from '../../utils/constants';

interface StockDetailDialogProps {
  open: boolean;
  stockCode: string;
  stockName: string;
  onClose: () => void;
  signalTags?: SignalTagType[];
}

/** 计算MA均线 */
function calcMA(data: KLineData[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0);
    return +(sum / period).toFixed(2);
  });
}

export default function StockDetailDialog({
  open,
  stockCode,
  stockName,
  onClose,
  signalTags = [],
}: StockDetailDialogProps) {
  const { klineData, loading, open: openDetail, close: closeDetail } = useStockDetail();
  const { chartRef, chartInstance } = useECharts();
  const [chartType, setChartType] = useState<'kline' | 'fenshi'>('kline');

  useEffect(() => {
    if (open && stockCode) {
      openDetail(stockCode, stockName);
    }
    if (!open) {
      closeDetail();
    }
  }, [open, stockCode, stockName, openDetail, closeDetail]);

  /** K线图 */
  useEffect(() => {
    if (!chartInstance.current || klineData.length === 0) return;

    const dates = klineData.map((k) => formatDate(k.date));
    const ohlc = klineData.map((k) => [k.open, k.close, k.low, k.high]);
    const volumes = klineData.map((k) => k.volume);
    const ma5 = calcMA(klineData, 5);
    const ma10 = calcMA(klineData, 10);
    const ma20 = calcMA(klineData, 20);

    setChartOption(chartInstance.current, {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: '#1c1c1c',
        borderColor: '#333',
        textStyle: { color: '#e0e0e0', fontSize: 11 },
      },
      legend: {
        data: ['MA5', 'MA10', 'MA20'],
        textStyle: { color: '#aaa', fontSize: 10 },
        top: 0,
      },
      grid: [
        { left: 50, right: 10, top: 30, height: '55%' },
        { left: 50, right: 10, top: '72%', height: '18%' },
      ],
      xAxis: [
        { type: 'category', data: dates, gridIndex: 0, axisLabel: { color: '#666', fontSize: 9 }, axisLine: { lineStyle: { color: '#2a2a2a' } } },
        { type: 'category', data: dates, gridIndex: 1, axisLabel: { show: false }, axisLine: { lineStyle: { color: '#2a2a2a' } } },
      ],
      yAxis: [
        { scale: true, gridIndex: 0, axisLabel: { color: '#666', fontSize: 9 }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
        { scale: true, gridIndex: 1, axisLabel: { show: false }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: ohlc,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: '#e84040',
            color0: '#00c0a0',
            borderColor: '#e84040',
            borderColor0: '#00c0a0',
          },
        },
        { name: 'MA5', type: 'line', data: ma5, xAxisIndex: 0, yAxisIndex: 0, lineStyle: { color: MA_COLORS.ma5, width: 1 }, itemStyle: { color: MA_COLORS.ma5 }, symbol: 'none', smooth: true },
        { name: 'MA10', type: 'line', data: ma10, xAxisIndex: 0, yAxisIndex: 0, lineStyle: { color: MA_COLORS.ma10, width: 1 }, itemStyle: { color: MA_COLORS.ma10 }, symbol: 'none', smooth: true },
        { name: 'MA20', type: 'line', data: ma20, xAxisIndex: 0, yAxisIndex: 0, lineStyle: { color: MA_COLORS.ma20, width: 1 }, itemStyle: { color: MA_COLORS.ma20 }, symbol: 'none', smooth: true },
        {
          name: '成交量',
          type: 'bar',
          data: volumes,
          xAxisIndex: 1,
          yAxisIndex: 1,
          itemStyle: {
            color: (params: { dataIndex: number }) => {
              const k = klineData[params.dataIndex];
              return k && k.close >= k.open ? '#e84040' : '#00c0a0';
            },
          },
        },
      ],
    });
  }, [klineData]);

  if (!open) return null;

  const lastKline = klineData.length > 0 ? klineData[klineData.length - 1] : null;
  const changePct = lastKline ? ((lastKline.close - lastKline.open) / lastKline.open * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[800px] max-h-[85vh] rounded-lg border border-border flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-panel, #1c1c1c)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-text-primary text-base font-semibold">{stockName}</h3>
            <span className="text-text-muted text-xs">{stockCode}</span>
            {lastKline && (
              <>
                <span className={`text-sm font-semibold ${changePct >= 0 ? 'rise' : 'fall'}`}>
                  {formatPrice(lastKline.close)}
                </span>
                <span className={`text-xs ${changePct >= 0 ? 'rise' : 'fall'}`}>
                  {formatChangePct(changePct)}
                </span>
              </>
            )}
            {signalTags.map((tag) => (
              <SignalTag key={tag} tag={tag} />
            ))}
          </div>
          <button
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* 图表类型切换 */}
        <div className="flex items-center gap-3 px-5 py-1.5 border-b border-border shrink-0">
          {(['kline', 'fenshi'] as const).map((type) => (
            <button
              key={type}
              className={`text-xs pb-0.5 border-b-2 transition-colors ${
                chartType === type
                  ? 'text-orange border-orange'
                  : 'text-text-muted border-transparent hover:text-text-secondary'
              }`}
              onClick={() => setChartType(type)}
            >
              {type === 'kline' ? 'K线' : '分时'}
            </button>
          ))}
        </div>

        {/* 图表内容 */}
        <div className="flex-1 overflow-hidden p-3">
          {loading ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              加载中...
            </div>
          ) : (
            <div className="h-full">
              <div ref={chartRef as React.RefObject<HTMLDivElement>} className="w-full h-full" />
            </div>
          )}
        </div>

        {/* 底部因子分析区域 */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          <div className="text-text-muted text-[10px] mb-2">因子分析</div>
          <div className="grid grid-cols-7 gap-2">
            {[
              { label: '估值优势', value: 72 },
              { label: '涨势动力', value: 85 },
              { label: '资金热度', value: 68 },
              { label: '反弹潜力', value: 45 },
              { label: '市场温度', value: 56 },
              { label: '震荡程度', value: 38 },
              { label: '突破强度', value: 61 },
            ].map((factor) => (
              <div key={factor.label} className="text-center">
                <div className="text-text-primary text-xs font-semibold">{factor.value}</div>
                <div className="w-full h-1 bg-bg-secondary rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${factor.value}%`,
                      background: factor.value >= 70 ? '#e84040' : factor.value >= 50 ? '#ff8c00' : '#00c0a0',
                    }}
                  />
                </div>
                <div className="text-text-muted text-[9px] mt-0.5">{factor.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

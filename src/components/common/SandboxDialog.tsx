import { useState, useEffect, useRef, useCallback } from 'react';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import type { KLineData } from '../../types';
import { formatDate, formatPrice, formatChangePct } from '../../utils/format';
import { MA_COLORS } from '../../utils/constants';
import axios from 'axios';

/** 沙盘演练信号点 */
interface SandboxSignal {
  date: string;
  type: 'BUY' | 'SELL';
  price: number;
  reason: string;
}

/** 沙盘演练结果 */
interface SandboxResult {
  klineData: KLineData[];
  signals: SandboxSignal[];
  equityCurve: number[];
}

interface SandboxDialogProps {
  open: boolean;
  strategyId: string;
  strategyName: string;
  onClose: () => void;
}

/** 计算MA均线 */
function calcMA(data: KLineData[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0);
    return +(sum / period).toFixed(2);
  });
}

/** 生成模拟沙盘数据 */
function generateMockSandboxData(initialCapital: number): SandboxResult {
  const klineData: KLineData[] = [];
  const signals: SandboxSignal[] = [];
  const equityCurve: number[] = [];
  let basePrice = 25;
  let capital = initialCapital;
  let holding = false;
  let shares = 0;
  let buyPrice = 0;

  for (let i = 0; i < 120; i++) {
    const date = new Date(2026, 0, 2 + i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * 2;
    basePrice = Math.max(15, basePrice + change);
    const open = +(basePrice + (Math.random() - 0.5)).toFixed(2);
    const close = +(basePrice + (Math.random() - 0.5)).toFixed(2);
    const high = +(Math.max(open, close) + Math.random() * 1.5).toFixed(2);
    const low = +(Math.min(open, close) - Math.random() * 1.5).toFixed(2);
    const volume = Math.floor(Math.random() * 80000 + 20000);
    const dateStr = formatDate(date);

    klineData.push({
      stock_code: 'SANDBOX',
      date: dateStr,
      open,
      close,
      high,
      low,
      volume,
      ma5: null,
      ma10: null,
      ma20: null,
      ma30: null,
    });

    // 生成交易信号
    if (i > 5 && i < 115) {
      if (!holding && Math.random() < 0.08) {
        signals.push({ date: dateStr, type: 'BUY', price: close, reason: '策略触发买入' });
        holding = true;
        shares = Math.floor(capital / close / 100) * 100;
        buyPrice = close;
        capital -= shares * close;
      } else if (holding && Math.random() < 0.1) {
        signals.push({ date: dateStr, type: 'SELL', price: close, reason: '策略触发卖出' });
        holding = false;
        capital += shares * close;
        shares = 0;
        buyPrice = 0;
      }
    }

    // 资金曲线
    const currentEquity = capital + (holding ? shares * close : 0);
    equityCurve.push(+currentEquity.toFixed(2));
  }

  // 如果最后还持仓，按最后收盘价清仓
  if (holding && klineData.length > 0) {
    const lastClose = klineData[klineData.length - 1].close;
    capital += shares * lastClose;
  }

  return { klineData, signals, equityCurve };
}

type PlaySpeed = 1 | 2 | 4;

export default function SandboxDialog({
  open,
  strategyName,
  onClose,
}: SandboxDialogProps) {
  const { chartRef: klineChartRef, chartInstance: klineChartInstance } = useECharts();
  const { chartRef: equityChartRef, chartInstance: equityChartInstance } = useECharts();

  const [initialCapital, setInitialCapital] = useState(100000);
  const [startDate] = useState('2026-01-02');
  const [endDate] = useState('2026-06-01');
  const [sandboxData, setSandboxData] = useState<SandboxResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaySpeed>(1);
  const [loaded, setLoaded] = useState(false);

  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 初始化沙盘数据 */
  useEffect(() => {
    if (open && !loaded) {
      const data = generateMockSandboxData(initialCapital);
      setSandboxData(data);
      setProgress(0);
      setLoaded(true);
    }
    if (!open) {
      setLoaded(false);
      setPlaying(false);
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
  }, [open, initialCapital, loaded]);

  /** 渲染K线图 + 买卖点 */
  useEffect(() => {
    if (!klineChartInstance.current || !sandboxData) return;

    const maxIdx = Math.min(Math.floor(progress / 100 * sandboxData.klineData.length), sandboxData.klineData.length);
    const visibleKline = sandboxData.klineData.slice(0, maxIdx);
    const visibleSignals = sandboxData.signals.filter((s) => {
      const idx = visibleKline.findIndex((k) => k.date === s.date);
      return idx >= 0;
    });

    if (visibleKline.length === 0) return;

    const dates = visibleKline.map((k) => k.date);
    const ohlc = visibleKline.map((k) => [k.open, k.close, k.low, k.high]);
    const volumes = visibleKline.map((k) => k.volume);
    const ma5 = calcMA(visibleKline, 5);
    const ma10 = calcMA(visibleKline, 10);

    // 买卖点标记
    const buyMarks = visibleKline.map((k) => {
      const sig = visibleSignals.find((s) => s.date === k.date && s.type === 'BUY');
      return sig ? sig.price : null;
    });
    const sellMarks = visibleKline.map((k) => {
      const sig = visibleSignals.find((s) => s.date === k.date && s.type === 'SELL');
      return sig ? sig.price : null;
    });

    setChartOption(klineChartInstance.current, {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, backgroundColor: '#1c1c1c', borderColor: '#333', textStyle: { color: '#e0e0e0', fontSize: 11 } },
      legend: { data: ['MA5', 'MA10', '买入', '卖出'], textStyle: { color: '#aaa', fontSize: 10 }, top: 0 },
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
        { name: 'K线', type: 'candlestick', data: ohlc, xAxisIndex: 0, yAxisIndex: 0, itemStyle: { color: '#e84040', color0: '#00c0a0', borderColor: '#e84040', borderColor0: '#00c0a0' } },
        { name: 'MA5', type: 'line', data: ma5, xAxisIndex: 0, yAxisIndex: 0, lineStyle: { color: MA_COLORS.ma5, width: 1 }, itemStyle: { color: MA_COLORS.ma5 }, symbol: 'none', smooth: true },
        { name: 'MA10', type: 'line', data: ma10, xAxisIndex: 0, yAxisIndex: 0, lineStyle: { color: MA_COLORS.ma10, width: 1 }, itemStyle: { color: MA_COLORS.ma10 }, symbol: 'none', smooth: true },
        { name: '买入', type: 'scatter', data: buyMarks, xAxisIndex: 0, yAxisIndex: 0, symbol: 'triangle', symbolSize: 10, itemStyle: { color: '#e84040' } },
        { name: '卖出', type: 'scatter', data: sellMarks, xAxisIndex: 0, yAxisIndex: 0, symbol: 'triangle', symbolSize: 10, symbolRotate: 180, itemStyle: { color: '#00c0a0' } },
        { name: '成交量', type: 'bar', data: volumes, xAxisIndex: 1, yAxisIndex: 1, itemStyle: { color: (params: { dataIndex: number }) => { const k = visibleKline[params.dataIndex]; return k && k.close >= k.open ? '#e84040' : '#00c0a0'; } } },
      ],
    });
  }, [sandboxData, progress, klineChartInstance]);

  /** 渲染资金曲线图 */
  useEffect(() => {
    if (!equityChartInstance.current || !sandboxData) return;

    const maxIdx = Math.min(Math.floor(progress / 100 * sandboxData.equityCurve.length), sandboxData.equityCurve.length);
    const visibleEquity = sandboxData.equityCurve.slice(0, maxIdx);
    const visibleKline = sandboxData.klineData.slice(0, maxIdx);

    if (visibleEquity.length === 0) return;

    const dates = visibleKline.map((k) => k.date);
    const benchmarkLine = visibleEquity.map((_, i) => initialCapital);

    setChartOption(equityChartInstance.current, {
      tooltip: { trigger: 'axis', backgroundColor: '#1c1c1c', borderColor: '#333', textStyle: { color: '#e0e0e0', fontSize: 11 } },
      legend: { data: ['资金曲线', '初始资金'], textStyle: { color: '#aaa', fontSize: 10 }, top: 0 },
      grid: { left: 50, right: 10, top: 25, bottom: 25 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#666', fontSize: 9 }, axisLine: { lineStyle: { color: '#2a2a2a' } } },
      yAxis: { type: 'value', axisLabel: { color: '#666', fontSize: 9, formatter: (v: number) => `${(v / 10000).toFixed(1)}万` }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
      series: [
        { name: '资金曲线', type: 'line', data: visibleEquity, lineStyle: { color: '#ff8c00', width: 1.5 }, itemStyle: { color: '#ff8c00' }, symbol: 'none', smooth: true, areaStyle: { color: 'rgba(255,140,0,0.1)' } },
        { name: '初始资金', type: 'line', data: benchmarkLine, lineStyle: { color: '#666', width: 1, type: 'dashed' }, itemStyle: { color: '#666' }, symbol: 'none' },
      ],
    });
  }, [sandboxData, progress, equityChartInstance, initialCapital]);

  /** 播放控制 */
  useEffect(() => {
    if (playing && sandboxData) {
      const step = speed;
      playTimerRef.current = setInterval(() => {
        setProgress((prev) => {
          const next = prev + step;
          if (next >= 100) {
            setPlaying(false);
            return 100;
          }
          return next;
        });
      }, 200);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [playing, speed, sandboxData]);

  const handlePlay = useCallback(() => {
    if (progress >= 100) setProgress(0);
    setPlaying(true);
  }, [progress]);

  const handlePause = useCallback(() => {
    setPlaying(false);
  }, []);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setProgress(0);
  }, []);

  /** 实时统计 */
  const stats = (() => {
    if (!sandboxData) return null;
    const maxIdx = Math.min(Math.floor(progress / 100 * sandboxData.klineData.length), sandboxData.klineData.length);
    const currentEquity = maxIdx > 0 ? sandboxData.equityCurve[maxIdx - 1] : initialCapital;
    const totalReturn = ((currentEquity - initialCapital) / initialCapital) * 100;
    const visibleSignals = sandboxData.signals.filter((s) => {
      const idx = sandboxData.klineData.findIndex((k) => k.date === s.date);
      return idx >= 0 && idx < maxIdx;
    });
    const buyCount = visibleSignals.filter((s) => s.type === 'BUY').length;
    const sellCount = visibleSignals.filter((s) => s.type === 'SELL').length;

    // 计算胜率（简化：每次卖出后判断盈亏）
    let winCount = 0;
    let totalTrades = 0;
    let cumBuyPrice = 0;
    for (const sig of visibleSignals) {
      if (sig.type === 'BUY') {
        cumBuyPrice = sig.price;
      } else if (sig.type === 'SELL' && cumBuyPrice > 0) {
        totalTrades++;
        if (sig.price > cumBuyPrice) winCount++;
        cumBuyPrice = 0;
      }
    }
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    // 最大回撤
    let maxDrawdown = 0;
    const equitySlice = sandboxData.equityCurve.slice(0, maxIdx);
    let peak = 0;
    for (const eq of equitySlice) {
      if (eq > peak) peak = eq;
      const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
      currentEquity,
      totalReturn,
      signalCount: buyCount + sellCount,
      winRate,
      maxDrawdown,
    };
  })();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[960px] max-h-[85vh] rounded-lg border border-border flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-panel, #1c1c1c)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-text-primary text-base font-semibold">沙盘演练</h3>
            <span className="text-text-muted text-xs">策略：{strategyName}</span>
          </div>
          <button
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* 顶部参数 */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-xs">日期范围：</span>
            <span className="text-text-secondary text-xs">{startDate} ~ {endDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-xs">初始资金：</span>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => {
                setInitialCapital(Number(e.target.value) || 100000);
                setLoaded(false);
              }}
              className="w-24 bg-bg-secondary border border-border text-text-primary text-xs px-2 py-1 rounded focus:outline-none focus:border-orange/50"
            />
            <span className="text-text-muted text-xs">元</span>
          </div>
          <button
            className="px-3 py-1 rounded text-xs bg-orange/15 text-orange border border-orange/30 hover:bg-orange hover:text-black transition-colors"
            onClick={() => { setLoaded(false); }}
          >
            重新生成
          </button>
        </div>

        {/* 主体内容：左侧图表 + 右侧统计 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：图表 + 播放控制 */}
          <div className="flex flex-col flex-1 border-r border-border">
            {/* K线图+买卖点 */}
            <div className="flex-1 overflow-hidden p-3">
              <div className="h-full">
                <div ref={klineChartRef as React.RefObject<HTMLDivElement>} className="w-full h-full" />
              </div>
            </div>

            {/* 资金曲线图 */}
            <div className="h-[140px] px-3 pb-1">
              <div ref={equityChartRef as React.RefObject<HTMLDivElement>} className="w-full h-full" />
            </div>

            {/* 播放控制条 */}
            <div className="flex items-center gap-3 px-5 py-2 border-t border-border shrink-0">
              {/* 进度条 */}
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="flex-1 h-1 appearance-none bg-bg-secondary rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange [&::-webkit-slider-thumb]:cursor-pointer"
              />

              {/* 播放/暂停/重置 */}
              <div className="flex items-center gap-1">
                {playing ? (
                  <button
                    className="w-7 h-7 rounded bg-bg-secondary border border-border flex items-center justify-center text-text-secondary hover:text-orange transition-colors"
                    onClick={handlePause}
                  >
                    ⏸
                  </button>
                ) : (
                  <button
                    className="w-7 h-7 rounded bg-orange text-black flex items-center justify-center text-xs font-bold hover:bg-orange/80 transition-colors"
                    onClick={handlePlay}
                  >
                    ▶
                  </button>
                )}
                <button
                  className="w-7 h-7 rounded bg-bg-secondary border border-border flex items-center justify-center text-text-secondary hover:text-orange transition-colors"
                  onClick={handleReset}
                >
                  ⟲
                </button>
              </div>

              {/* 速度选择 */}
              <div className="flex items-center gap-1">
                {([1, 2, 4] as PlaySpeed[]).map((s) => (
                  <button
                    key={s}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      speed === s
                        ? 'bg-orange/15 text-orange border border-orange/30'
                        : 'bg-bg-secondary border border-border text-text-muted'
                    }`}
                    onClick={() => setSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <span className="text-text-muted text-[10px] w-12 text-right">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* 右侧：实时统计面板 */}
          <div className="w-[220px] p-4 overflow-y-auto">
            <h5 className="text-text-primary text-xs font-semibold mb-3">实时统计</h5>
            {stats ? (
              <div className="space-y-3">
                <div className="rounded-lg p-3 border border-border" style={{ background: 'var(--bg-card, #181818)' }}>
                  <div className="text-text-muted text-[10px] mb-1">当前资金</div>
                  <div className="text-text-primary text-sm font-semibold">
                    ¥{stats.currentEquity.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg p-3 border border-border" style={{ background: 'var(--bg-card, #181818)' }}>
                  <div className="text-text-muted text-[10px] mb-1">总收益率</div>
                  <div className={`text-sm font-semibold ${stats.totalReturn >= 0 ? 'rise' : 'fall'}`}>
                    {formatChangePct(stats.totalReturn)}
                  </div>
                </div>
                <div className="rounded-lg p-3 border border-border" style={{ background: 'var(--bg-card, #181818)' }}>
                  <div className="text-text-muted text-[10px] mb-1">已执行信号数</div>
                  <div className="text-text-primary text-sm font-semibold">{stats.signalCount}</div>
                </div>
                <div className="rounded-lg p-3 border border-border" style={{ background: 'var(--bg-card, #181818)' }}>
                  <div className="text-text-muted text-[10px] mb-1">胜率</div>
                  <div className="text-orange text-sm font-semibold">
                    {stats.winRate.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-lg p-3 border border-border" style={{ background: 'var(--bg-card, #181818)' }}>
                  <div className="text-text-muted text-[10px] mb-1">最大回撤</div>
                  <div className="fall text-sm font-semibold">
                    -{stats.maxDrawdown.toFixed(2)}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-text-muted text-xs">等待数据...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

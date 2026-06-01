import { http, HttpResponse } from 'msw';

/** 生成模拟沙盘K线数据 */
function generateSandboxKline(days: number) {
  const kline: Array<{
    date: string;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
  }> = [];
  let basePrice = 25;

  for (let i = 0; i < days; i++) {
    const date = new Date(2026, 0, 2 + i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * 2;
    basePrice = Math.max(15, basePrice + change);
    const open = +(basePrice + (Math.random() - 0.5)).toFixed(2);
    const close = +(basePrice + (Math.random() - 0.5)).toFixed(2);
    const high = +(Math.max(open, close) + Math.random() * 1.5).toFixed(2);
    const low = +(Math.min(open, close) - Math.random() * 1.5).toFixed(2);
    const volume = Math.floor(Math.random() * 80000 + 20000);

    kline.push({
      date: date.toISOString().slice(0, 10),
      open,
      close,
      high,
      low,
      volume,
    });
  }
  return kline;
}

/** 生成模拟交易信号 */
function generateSandboxSignals(kline: Array<{ date: string; close: number }>) {
  const signals: Array<{
    date: string;
    type: 'BUY' | 'SELL';
    price: number;
    reason: string;
  }> = [];

  for (let i = 5; i < kline.length - 5; i++) {
    if (!kline[i]) continue;
    if (Math.random() < 0.06) {
      signals.push({
        date: kline[i].date,
        type: 'BUY',
        price: kline[i].close,
        reason: '策略触发买入信号',
      });
    } else if (signals.length > 0 && signals[signals.length - 1].type === 'BUY' && Math.random() < 0.08) {
      signals.push({
        date: kline[i].date,
        type: 'SELL',
        price: kline[i].close,
        reason: '策略触发卖出信号',
      });
    }
  }
  return signals;
}

/** 生成模拟资金曲线 */
function generateEquityCurve(
  kline: Array<{ date: string; close: number }>,
  signals: Array<{ date: string; type: 'BUY' | 'SELL'; price: number }>,
  initialCapital: number
) {
  let capital = initialCapital;
  let holding = false;
  let shares = 0;
  const curve: number[] = [];

  for (const bar of kline) {
    const sig = signals.find((s) => s.date === bar.date);
    if (sig) {
      if (sig.type === 'BUY' && !holding) {
        shares = Math.floor(capital / sig.price / 100) * 100;
        capital -= shares * sig.price;
        holding = true;
      } else if (sig.type === 'SELL' && holding) {
        capital += shares * sig.price;
        shares = 0;
        holding = false;
      }
    }
    const equity = capital + (holding ? shares * bar.close : 0);
    curve.push(+equity.toFixed(2));
  }
  return curve;
}

export const sandboxHandlers = [
  http.get('/api/sandbox/run', ({ request }) => {
    const url = new URL(request.url);
    const strategyId = url.searchParams.get('strategy_id') || 's1';
    const initialCapital = Number(url.searchParams.get('initial_capital')) || 100000;

    const kline = generateSandboxKline(120);
    const signals = generateSandboxSignals(kline);
    const equityCurve = generateEquityCurve(kline, signals, initialCapital);

    return HttpResponse.json({
      code: 0,
      data: {
        strategy_id: strategyId,
        kline_data: kline,
        signals,
        equity_curve: equityCurve,
      },
      message: 'ok',
    });
  }),
];

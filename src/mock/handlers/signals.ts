import { http, HttpResponse } from 'msw';
import signalsData from '../data/signals.json';
import type { Signal } from '../../types';

const BASE_FIXTURE_DATE = '2026-06-01';
const MOCK_MARKET_META: Record<string, { sector: string; changePct: number }> = {
  '600160': { sector: '化工原料', changePct: 10.01 },
  '002594': { sector: '新能源汽车', changePct: 4.29 },
  '600276': { sector: '创新药', changePct: 5.55 },
  '601899': { sector: '有色金属', changePct: 4.66 },
  '002230': { sector: 'AI应用', changePct: 3.82 },
  '300750': { sector: '动力电池', changePct: 2.73 },
  '000725': { sector: '面板', changePct: 1.48 },
  '600547': { sector: '黄金', changePct: 2.15 },
  '002415': { sector: '安防设备', changePct: -1.18 },
  '300059': { sector: '金融科技', changePct: -2.04 },
  '000858': { sector: '白酒', changePct: -0.86 },
  '600519': { sector: '白酒', changePct: 1.16 },
  '600600': { sector: '啤酒', changePct: 0.74 },
  '600690': { sector: '家用电器', changePct: 1.92 },
  '000333': { sector: '家用电器', changePct: 2.26 },
  '605020': { sector: '氟化工', changePct: 3.14 },
  '600104': { sector: '汽车整车', changePct: -1.37 },
  '601318': { sector: '保险', changePct: -0.65 },
  '002304': { sector: '白酒', changePct: -1.59 },
  '603288': { sector: '食品饮料', changePct: 0.48 },
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = startOfLocalDay(new Date(`${fromDate}T00:00:00`));
  const to = startOfLocalDay(new Date(`${toDate}T00:00:00`));
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function shiftSignalTime(signalTime: string, dayDelta: number): string {
  const shifted = new Date(`${signalTime.slice(0, 10)}T00:00:00`);
  shifted.setDate(shifted.getDate() + dayDelta);
  return `${formatDate(shifted)}${signalTime.slice(10)}`;
}

function buildDatedSignals(today = new Date()): Signal[] {
  const todayDate = formatDate(today);
  const dayDelta = daysBetween(BASE_FIXTURE_DATE, todayDate);
  return (signalsData as Signal[]).map((signal) => {
    const meta = MOCK_MARKET_META[signal.stock_code] || { sector: '未分类', changePct: 0 };
    return {
      ...signal,
      signal_time: shiftSignalTime(signal.signal_time, dayDelta),
      sector_name: meta.sector,
      score_breakdown: { '涨跌幅': meta.changePct },
    };
  });
}

function signalDate(signal: Signal): string {
  return signal.signal_time.slice(0, 10);
}

function isInPeriod(signal: Signal, period: string | null, today = new Date()): boolean {
  const currentDay = startOfLocalDay(today);
  const signalDay = startOfLocalDay(new Date(`${signalDate(signal)}T00:00:00`));

  if (period === 'week') {
    const weekStart = new Date(currentDay);
    weekStart.setDate(currentDay.getDate() - currentDay.getDay() + 1);
    return signalDay >= weekStart && signalDay <= currentDay;
  }

  if (period === 'month') {
    const monthStart = new Date(currentDay.getFullYear(), currentDay.getMonth(), 1);
    return signalDay >= monthStart && signalDay <= currentDay;
  }

  return formatDate(signalDay) === formatDate(currentDay);
}

function generateEmotion1(): Array<{ date: string; value: number }> {
  const data = [];
  const now = new Date();
  for (let i = 59; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toISOString().slice(0, 10),
      value: +(Math.random() * 80 + 10).toFixed(1),
    });
  }
  return data;
}

function generateEmotion2(): Array<{ date: string; inflow: number; outflow: number }> {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toISOString().slice(0, 10),
      inflow: +(Math.random() * 50 + 10).toFixed(1),
      outflow: +(Math.random() * 40 + 5).toFixed(1),
    });
  }
  return data;
}

export const signalHandlers = [
  http.get('/api/signals/timing', ({ request }) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || '主线';
    const date = url.searchParams.get('date');
    const datedSignals = buildDatedSignals();
    const filtered = datedSignals.filter((s) => {
      if (date && signalDate(s) !== date) return false;
      if (mode === '主线') return ['低吸', '趋势', '突破', '均值回归'].includes(s.mode);
      if (mode === 'ETF') return false;
      if (mode === '个股') return s.mode === '低吸';
      return true;
    });
    return HttpResponse.json({ code: 0, data: filtered, message: 'ok' });
  }),

  http.get('/api/signals/emotion1', () => {
    return HttpResponse.json({ code: 0, data: generateEmotion1(), message: 'ok' });
  }),

  http.get('/api/signals/emotion2', () => {
    return HttpResponse.json({ code: 0, data: generateEmotion2(), message: 'ok' });
  }),

  http.get('/api/signals/live', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const period = url.searchParams.get('period') || 'today';
    const search = url.searchParams.get('search')?.trim();
    const onlyHolding = url.searchParams.get('onlyHolding') === 'true';
    const onlyAlerting = url.searchParams.get('onlyAlerting') === 'true';

    const liveSignals = buildDatedSignals().filter((s) =>
      (s.status === 'executed' || s.status === 'pending') &&
      (!type || type === 'all' || s.signal_type === type) &&
      isInPeriod(s, period) &&
      (!search || s.stock_code.includes(search) || s.stock_name.includes(search)) &&
      (!onlyHolding || s.status === 'executed') &&
      (!onlyAlerting || ['warning', 'stop_loss', 'take_profit'].includes(s.alert_status))
    );
    return HttpResponse.json({ code: 0, data: liveSignals, message: 'ok' });
  }),

  http.get('/api/signals/live/stats', () => {
    const datedSignals = buildDatedSignals();
    const stats = {
      today_count: datedSignals.filter((s) => isInPeriod(s, 'today')).length,
      holding: datedSignals.filter((s) => s.status === 'executed').length,
      take_profit: datedSignals.filter((s) => s.alert_status === 'take_profit').length,
      stop_loss: datedSignals.filter((s) => s.alert_status === 'stop_loss').length,
      alerting: datedSignals.filter((s) => s.alert_status === 'warning').length,
    };
    return HttpResponse.json({ code: 0, data: stats, message: 'ok' });
  }),

  http.post('/api/signals/:id/execute', () => {
    return HttpResponse.json({ code: 0, data: null, message: 'ok' });
  }),

  http.post('/api/signals/:id/ignore', () => {
    return HttpResponse.json({ code: 0, data: null, message: 'ok' });
  }),

  http.put('/api/signals/:id/alert', () => {
    return HttpResponse.json({ code: 0, data: null, message: 'ok' });
  }),
];

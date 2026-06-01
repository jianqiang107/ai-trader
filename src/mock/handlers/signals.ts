import { http, HttpResponse } from 'msw';
import signalsData from '../data/signals.json';

function generateEmotion1(): Array<{ date: string; value: number }> {
  const data = [];
  const now = new Date('2026-06-01');
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
  const now = new Date('2026-06-01');
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
    const filtered = signalsData.filter((s) => {
      if (mode === '主线') return s.mode === '趋势' || s.mode === '突破';
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

  http.get('/api/signals/live', () => {
    const liveSignals = signalsData.filter((s) =>
      s.status === 'executed' || s.status === 'pending'
    );
    return HttpResponse.json({ code: 0, data: liveSignals, message: 'ok' });
  }),

  http.get('/api/signals/live/stats', () => {
    const stats = {
      today_count: signalsData.filter((s) => s.signal_time?.includes('2026-06-01')).length,
      holding: signalsData.filter((s) => s.status === 'executed').length,
      take_profit: signalsData.filter((s) => s.alert_status === 'take_profit').length,
      stop_loss: signalsData.filter((s) => s.alert_status === 'stop_loss').length,
      alerting: signalsData.filter((s) => s.alert_status === 'warning').length,
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

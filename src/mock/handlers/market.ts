import { http, HttpResponse } from 'msw';
import { INDICES } from '../../utils/constants';
import type { IndexData } from '../../types';
import klineJson from '../data/kline.json';

function generateIndices(): IndexData[] {
  return INDICES.map((idx) => {
    const change_pct = +(Math.random() * 3 - 1.2).toFixed(2);
    const price = +(idx.base * (1 + change_pct / 100)).toFixed(2);
    const change_amount = +(idx.base * change_pct / 100).toFixed(2);
    const open = +(idx.base * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2);
    const high = +(Math.max(price, open) * (1 + Math.random() * 0.005)).toFixed(2);
    const low = +(Math.min(price, open) * (1 - Math.random() * 0.005)).toFixed(2);
    const pre_close = +idx.base.toFixed(2);
    const volume = Math.floor(Math.random() * 50000000 + 10000000);
    const amount = Math.floor(Math.random() * 5000000000 + 1000000000);
    const amplitude = +((high - low) / pre_close * 100).toFixed(2);
    const volume_ratio = +(Math.random() * 1.5 + 0.5).toFixed(2);
    return {
      name: idx.name,
      code: idx.code,
      price,
      change_pct,
      change_amount,
      open,
      high,
      low,
      pre_close,
      volume,
      amount,
      amplitude,
      volume_ratio,
    };
  });
}

export const marketHandlers = [
  http.get('/api/market/indices', () => {
    return HttpResponse.json({ code: 0, data: generateIndices(), message: 'ok' });
  }),

  http.get('/api/market/kline', ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') || 'INDEX_AVG';
    const klineData = klineJson;
    const filtered = code === 'INDEX_AVG'
      ? klineData
      : klineData.map((k: Record<string, unknown>) => ({ ...k, stock_code: code }));
    return HttpResponse.json({ code: 0, data: filtered, message: 'ok' });
  }),

  http.get('/api/market/fenshi', () => {
    const data: Array<{ time: string; price: number; avg_price: number; volume: number }> = [];
    let price = 35.95;
    for (let m = 0; m < 240; m++) {
      const hour = m < 120 ? 9 : 13;
      const minute = m < 120 ? 30 + m : m - 120;
      const time = `${hour}:${String(minute % 60).padStart(2, '0')}`;
      price += (Math.random() - 0.49) * price * 0.002;
      const avg = +(price * (1 + (Math.random() - 0.5) * 0.003)).toFixed(2);
      data.push({ time, price: +price.toFixed(2), avg_price: avg, volume: Math.floor(Math.random() * 5000 + 500) });
    }
    return HttpResponse.json({ code: 0, data, message: 'ok' });
  }),

  http.get('/api/market/volfs', () => {
    const data: Array<{ date: string; vol_value: number; vol_signal: string }> = [];
    for (let i = 0; i < 240; i++) {
      const vol = Math.floor(Math.random() * 8000 + 500);
      data.push({
        date: `${i}`,
        vol_value: vol,
        vol_signal: vol > 5000 ? 'bullish' : vol > 2000 ? 'neutral' : 'bearish',
      });
    }
    return HttpResponse.json({ code: 0, data, message: 'ok' });
  }),
];

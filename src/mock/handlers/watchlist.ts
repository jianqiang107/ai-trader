import { http, HttpResponse } from 'msw';
import stocksData from '../data/stocks.json';

function generateWatchlist() {
  return stocksData.slice(0, 12).map((s) => ({
    code: s.code,
    name: s.name,
    price: s.price,
    change_pct: s.change_pct,
    change_amount: +(s.price * s.change_pct / 100).toFixed(2),
    volume: Math.floor(Math.random() * 200000 + 50000),
    amount: Math.floor(Math.random() * 50000 + 10000),
    amplitude: +(Math.random() * 5 + 1).toFixed(2),
  }));
}

export const watchlistHandlers = [
  http.get('/api/watchlist', () => {
    return HttpResponse.json({ code: 0, data: generateWatchlist(), message: 'ok' });
  }),

  http.post('/api/watchlist', () => {
    return HttpResponse.json({ code: 0, data: null, message: 'ok' });
  }),

  http.delete('/api/watchlist/:code', () => {
    return HttpResponse.json({ code: 0, data: null, message: 'ok' });
  }),
];

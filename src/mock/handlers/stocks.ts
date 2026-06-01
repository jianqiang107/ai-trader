import { http, HttpResponse } from 'msw';
import stocksData from '../data/stocks.json';
import sectorsData from '../data/sectors.json';

export const stockHandlers = [
  http.get('/api/stocks', ({ request }) => {
    const url = new URL(request.url);
    const sector = url.searchParams.get('sector');
    const mode = url.searchParams.get('mode');
    let data = stocksData;
    if (sector) {
      data = data.filter((s) => s.sector_codes?.includes(sector));
    }
    if (mode) {
      data = data.filter((s) => s.signal_tags?.includes(mode));
    }
    return HttpResponse.json({ code: 0, data, message: 'ok' });
  }),

  http.get('/api/sectors', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    let data = sectorsData;
    if (type) {
      data = data.filter((s) => s.type === type);
    }
    return HttpResponse.json({ code: 0, data, message: 'ok' });
  }),
];

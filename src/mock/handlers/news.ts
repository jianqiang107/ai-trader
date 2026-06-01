import { http, HttpResponse } from 'msw';
import newsData from '../data/news.json';

export const newsHandlers = [
  http.get('/api/news', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    let data = newsData;
    if (category) {
      data = data.filter((n) => n.category === category);
    }
    return HttpResponse.json({ code: 0, data, message: 'ok' });
  }),

  http.get('/api/news/bottom', () => {
    const data = newsData.slice(0, 12);
    return HttpResponse.json({ code: 0, data, message: 'ok' });
  }),

  http.get('/api/news/:id', ({ params }) => {
    const news = newsData.find((n) => n.id === params.id);
    return HttpResponse.json({ code: 0, data: news || null, message: 'ok' });
  }),
];

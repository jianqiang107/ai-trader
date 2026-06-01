import { http, HttpResponse } from 'msw';
import strategiesData from '../data/strategies.json';

export const strategyHandlers = [
  http.get('/api/strategies', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    let data = strategiesData;
    if (type) {
      data = data.filter((s) => s.type === type);
    }
    return HttpResponse.json({ code: 0, data, message: 'ok' });
  }),

  http.get('/api/strategies/:id', ({ params }) => {
    const strategy = strategiesData.find((s) => s.id === params.id);
    return HttpResponse.json({ code: 0, data: strategy || null, message: 'ok' });
  }),

  http.get('/api/strategies/:id/performance', () => {
    const dates: string[] = [];
    const strategyValues: number[] = [];
    const benchmarkValues: number[] = [];
    let strat = 0;
    let bench = 0;
    const start = new Date('2026-03-01');
    for (let d = new Date(start); d <= new Date('2026-06-01'); d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      dates.push(d.toISOString().slice(0, 10));
      strat += (Math.random() * 3 - 0.5);
      bench += (Math.random() * 1.5 - 0.5);
      strategyValues.push(+strat.toFixed(2));
      benchmarkValues.push(+bench.toFixed(2));
    }
    const data = {
      dates,
      strategy_values: strategyValues,
      benchmark_values: benchmarkValues,
      total_return: +strat.toFixed(2),
      max_drawdown: -8.3,
      sharpe_ratio: 2.15,
      trades: strategiesData.slice(0, 8).map((s, i) => ({
        id: `trade_${i + 1}`,
        stock_code: ['600160', '002594', '600276', '601899', '002230', '300750', '000725', '600547'][i],
        stock_name: ['巨化股份', '比亚迪', '恒瑞医药', '紫金矿业', '科大讯飞', '宁德时代', '京东方A', '山东黄金'][i],
        strategy_id: s.id,
        buy_date: `2026-0${3 + Math.floor(i / 3)}-${String(5 + i * 3).padStart(2, '0')}`,
        buy_price: +(Math.random() * 50 + 10).toFixed(2),
        position_pct: (Math.floor(Math.random() * 3) + 1) * 10,
        sell_date: `2026-0${4 + Math.floor(i / 4)}-${String(8 + i * 2).padStart(2, '0')}`,
        sell_price: +(Math.random() * 60 + 12).toFixed(2),
        pnl_pct: +(Math.random() * 25 - 5).toFixed(2),
        sector: ['氢概念', '新能源', '医药', '有色金属', 'AI算力', '新能源', '芯片', '有色金属'][i],
      })),
    };
    return HttpResponse.json({ code: 0, data, message: 'ok' });
  }),

  http.post('/api/strategies/:id/subscribe', () => {
    return HttpResponse.json({ code: 0, data: null, message: 'ok' });
  }),

  http.get('/api/strategies/:id/factors', () => {
    const data = [
      { label: '估值优势', value: 72, change: 3.5, status: 'normal' as const },
      { label: '涨势动力', value: 85, change: 5.2, status: 'normal' as const },
      { label: '资金热度', value: 68, change: -2.1, status: 'normal' as const },
      { label: '反弹潜力', value: 45, change: -8.3, status: 'warning' as const },
      { label: '市场温度', value: 56, change: 1.8, status: 'normal' as const },
    ];
    return HttpResponse.json({ code: 0, data, message: 'ok' });
  }),
];

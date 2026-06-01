import { http, HttpResponse } from 'msw';

export const userHandlers = [
  http.post('/api/user/login', () => {
    return HttpResponse.json({
      code: 0,
      data: {
        token: 'mock-jwt-token-12345',
        user: {
          id: 'u001',
          phone: '138****8888',
          nickname: '交易达人',
          avatar: '',
          plan: 'pro',
          plan_expires_at: '2027-06-01',
          auto_renew: true,
          watchlist: ['600160', '002594', '300750'],
          signal_preferences: {},
          alert_settings: {
            stop_loss_price: -5,
            take_profit_price: 10,
            alert_method: 'notification' as const,
            alert_frequency: 'once' as const,
          },
        },
      },
      message: 'ok',
    });
  }),

  http.post('/api/user/register', () => {
    return HttpResponse.json({ code: 0, data: null, message: 'ok' });
  }),

  http.get('/api/user/profile', () => {
    return HttpResponse.json({
      code: 0,
      data: {
        id: 'u001',
        phone: '138****8888',
        nickname: '交易达人',
        avatar: '',
        plan: 'pro',
        plan_expires_at: '2027-06-01',
        auto_renew: true,
        watchlist: ['600160', '002594', '300750'],
        signal_preferences: {},
        alert_settings: {
          stop_loss_price: -5,
          take_profit_price: 10,
          alert_method: 'notification',
          alert_frequency: 'once',
        },
      },
      message: 'ok',
    });
  }),

  http.put('/api/user/alert-settings', () => {
    return HttpResponse.json({ code: 0, data: null, message: 'ok' });
  }),

  http.get('/api/user/notifications', () => {
    return HttpResponse.json({
      code: 0,
      data: [
        { id: 'ntf1', type: 'signal', title: '新信号提醒', content: '巨化股份出现低吸信号', read: false, created_at: '2026-06-01T09:35:00+08:00' },
        { id: 'ntf2', type: 'system', title: '系统升级通知', content: '系统将于今晚22:00进行维护升级', read: false, created_at: '2026-06-01T08:00:00+08:00' },
        { id: 'ntf3', type: 'expiry', title: '会员到期提醒', content: '您的专业版会员将于7天后到期', read: true, created_at: '2026-05-30T10:00:00+08:00' },
      ],
      message: 'ok',
    });
  }),
];

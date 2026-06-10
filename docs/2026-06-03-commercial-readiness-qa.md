# 2026-06-03 商用上线 QA 遍历报告

## 结论

当前版本不能按商用正式上线标准发布。前端路由、基础行情、登录后部分信号链路可以跑通，但仍存在固定验证码、空实现 API、mock/随机数据、关键数据源缺失和测试覆盖不足等问题。

## 已执行检查

- 线上路由：`/`、`/timing`、`/stocks`、`/sectors`、`/strategy`、`/performance`、`/news`、`/membership`、`/signals`、`/watchlist` 均返回 HTML 200。
- 鉴权：未登录访问 `/signals/live`、`/watchlist`、`/strategies` 返回 401。
- 登录：`13800000001` + `123456` 可登录，返回 token。
- API 遍历：用户、行情、策略、信号、资讯、自选接口均做了线上调用。
- 构建：`npm run build` 通过。
- 后端语法：`python3 -m py_compile backend/main.py backend/routers/*.py backend/services/*.py backend/models/*.py backend/schemas/*.py` 通过。

## P0 阻塞问题

1. 验证码仍是固定 `123456`，且前端 `authService.sendVerifyCode(phone)` 没有把手机号传给后端。真实调用无 body 会返回 422。
2. 自选股后端是空实现：添加返回成功，但再次获取仍是空列表。
3. 策略绩效和因子数据仍是 mock/随机生成，不可用于收费展示或投资决策。
4. 信号生成仍使用 `MOCK_STOCKS` 随机选股和随机价格，不能宣称为真实策略推荐。
5. 资讯接口是静态 `NEWS_ITEMS`，不是实时新闻源或可审计的 AI 资讯。

## P1 高风险问题

1. 资金流向 `/market/fundflow` 对 `600519.SH` 返回业务 404。
2. 北向资金 `/market/northflow` 返回业务 404。
3. 通知列表 `/user/notifications` 永远返回空数组。
4. 预警偏好 `/user/alert-settings` 返回成功但不持久化。
5. ETF 模式仍是前端固定 `ETF_MOCK`，不会随市场更新。
6. 分时右侧说明仍有 mock 注释，量能 VOLFS 也是算法生成数据。
7. `/bad-route` 返回 SPA HTML 200，但前端没有明确 404 页面。
8. 本地 `backend/static` 残留旧构建产物，包含旧版 401 跳转逻辑，容易误部署。

## P2 上线前应补强

1. 缺少自动化测试套件；目前只有构建和语法检查。
2. ECharts chunk 超过 1MB，首屏性能和弱网加载有风险。
3. SQLite 适合 MVP，不适合作为商用多用户长期数据库。
4. JWT secret 默认值仍在代码中，需要生产环境强制配置。
5. 没有真实短信、支付、会员开通、订单和发票链路。
6. 没有 API 监控、错误告警、数据源健康检查面板。

## 需补 API / 数据能力

- 真实短信验证码发送与校验，含频控、过期、重发限制。
- 自选股 CRUD 持久化，并返回实时行情字段。
- 预警偏好持久化与触发通知。
- 通知中心真实通知列表、已读状态和分页。
- 策略绩效基于真实交易/回测结果，而不是随机曲线。
- 因子计算基于策略文档中的真实因子，至少先实现技术因子 MVP。
- ETF 实时列表与 ETF 信号接口。
- 资金流、北向资金、新闻资讯的真实数据源或明确降级状态。

## 测试覆盖缺口

本机没有 Playwright 运行时，本轮未完成 DOM 点击级自动化测试和截图验收。上线前必须补 E2E：登录、路由切换、股票详情、信号执行、加自选、预警设置、会员开通、错误态、移动端布局。

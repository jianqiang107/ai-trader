# 行情数据后端 + 前后端对接 — 完成报告

## 完成内容

### 后端 (backend/)
- **FastAPI + AKShare** 行情数据服务，8个API端点
- **缓存层**：内存缓存（TTL 30s~300s），生产环境替换 Redis
- **数据源**：东方财富（通过 AKShare 免费获取）
- **部署**：Docker + docker-compose 一键启动

### API 端点

| 端点 | 说明 | 缓存 |
|------|------|------|
| GET /api/market/indices | 大盘指数 | 60s |
| GET /api/market/kline | K线数据 | 300s |
| GET /api/market/fenshi | 分时数据 | 60s |
| GET /api/market/volfs | 量能数据 | - |
| GET /api/market/quote | 个股实时报价 | 30s |
| GET /api/market/stocks | 个股列表 | 60s |
| GET /api/market/sectors | 板块列表 | 120s |
| GET /api/market/fundflow | 资金流向 | 120s |
| GET /api/market/northflow | 北向资金 | 300s |

### 前端对接
- `vite.config.ts` 添加 `/api` → `localhost:8000` 代理
- `App.tsx` 支持 `VITE_USE_MSW` 环境变量切换 Mock/真实 API
- `.env.production` 关闭 MSW 走真实 API
- 字段命名 snake_case 完全对齐前端 TypeScript 类型

### 文件清单
```
backend/
├── main.py                    # FastAPI 入口
├── run.py                     # 启动脚本
├── requirements.txt           # Python 依赖
├── Dockerfile                 # Docker 构建
├── docker-compose.yml         # Docker Compose
├── README.md                  # 使用文档
├── routers/
│   ├── __init__.py
│   └── market.py              # 行情路由（8端点）
└── services/
    ├── __init__.py
    ├── akshare_service.py     # AKShare 数据服务
    └── cache_service.py       # 内存缓存

前端修改:
├── vite.config.ts             # 添加 /api 代理
├── src/App.tsx                # VITE_USE_MSW 切换
├── .env.production            # 生产环境变量
└── .gitignore                 # 添加 backend/venv
```

## 下一步

1. **部署后端到云服务器**（需能访问东方财富 API）
2. 切换 `.env` 为 `VITE_USE_MSW=false`，启动真实数据
3. 继续推进 P0 其他模块：因子计算引擎、信号生成系统、用户系统

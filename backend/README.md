# AI交易大师 - 行情数据后端

FastAPI + AKShare 构建的行情数据 API 服务。

## 快速启动

### 方式一：直接运行

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 启动服务
python run.py --reload
```

### 方式二：Docker

```bash
cd backend
docker-compose up -d
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/market/indices` | GET | 大盘指数 |
| `/api/market/kline?code=600519.SH&period=daily` | GET | K线数据 |
| `/api/market/fenshi?code=600519.SH` | GET | 分时数据 |
| `/api/market/volfs?code=600519.SH` | GET | 量能数据 |
| `/api/market/quote?code=600519.SH` | GET | 个股实时报价 |
| `/api/market/stocks?page=1&pageSize=50` | GET | 个股列表 |
| `/api/market/sectors?type=concept` | GET | 板块列表 |
| `/api/market/fundflow?code=600519.SH` | GET | 资金流向 |
| `/api/market/northflow` | GET | 北向资金 |

启动后访问 `http://localhost:8000/docs` 查看完整 API 文档。

## 前端对接

前端 Vite 开发模式下，`/api` 请求会自动代理到 `localhost:8000`。

切换 Mock / 真实 API：
- Mock 模式（默认）：`.env` 中 `VITE_USE_MSW=true`
- 真实 API：`.env` 中 `VITE_USE_MSW=false`，并启动后端服务

## 数据源

[AKShare](https://github.com/akfamily/akshare) — 免费开源的金融数据接口库，数据来自东方财富。

## 缓存策略

| 数据类型 | 缓存时间 | 说明 |
|----------|---------|------|
| 大盘指数 | 60s | 交易时间内频繁更新 |
| K线数据 | 300s | 日K变化较慢 |
| 分时数据 | 60s | 需要较高实时性 |
| 个股报价 | 30s | 实时性要求最高 |
| 板块数据 | 120s | 中等实时性 |
| 资金流向 | 120s | 日级更新 |
| 北向资金 | 300s | 日级更新 |

生产环境建议替换 `cache_service.py` 为 Redis。

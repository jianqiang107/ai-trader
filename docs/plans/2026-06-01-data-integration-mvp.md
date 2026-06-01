# 数据接入 MVP — 行情数据源实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 FastAPI + AKShare 搭建行情数据后端，替换前端所有 mock 数据为真实行情

**Architecture:** Python FastAPI 后端挂载 AKShare 免费数据源，Vite 前端通过 `/api` 代理转发。后端做数据缓存（5 分钟），减小 AKShare 调用频率。

**Tech Stack:** Python 3.13 + FastAPI + AKShare + uvicorn / 前端不变 (Vite + React + TS)

---

## 整体架构

```
浏览器 (React) ──GET /api/market/indices──▶ Vite Proxy ──▶ FastAPI :8000
                                                              │
                                                        AKShare (东方财富/新浪等)
```

## 分步任务

### Task 1: 初始化 Python 后端项目

**说明:** 创建 backend/ 目录，安装 FastAPI + AKShare + uvicorn，验证可用

**Step 1:** 创建后端目录结构

```
backend/
  requirements.txt
  main.py              # FastAPI 入口
  routers/
    __init__.py
    market.py           # 行情相关 API
  services/
    __init__.py
    akshare_service.py  # AKShare 封装
    cache_service.py    # 简易内存缓存
```

**Step 2:** 安装依赖

```bash
cd backend
/Users/jianqiangwang/.workbuddy/binaries/python/versions/3.13.12/bin/python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn akshare
```

**Step 3:** 验证 AKShare 可用

```python
import akshare as ak
df = ak.stock_zh_index_spot_em()  # 东方财富实时指数
print(df.head())
```

---

### Task 2: 实现 AKShare 行情服务封装

**说明:** 封装 AKShare 调用，返回与前端类型匹配的数据结构

**关键 AKShare 接口：**
| 需求 | AKShare 函数 |
|------|-------------|
| 实时指数 | `ak.stock_zh_index_spot_em()` |
| 个股 K 线 | `ak.stock_zh_a_hist(symbol, period, start_date, end_date)` |
| 个股分时 | `ak.stock_zh_a_minute(symbol)` |
| 行业板块 | `ak.stock_board_industry_name_em()` |
| 概念板块 | `ak.stock_board_concept_name_em()` |
| 资金流向 | `ak.stock_individual_fund_flow(stock)` |

---

### Task 3: 创建 FastAPI 行情路由

**说明:** 实现 `/api/market/indices`, `/api/market/kline`, `/api/market/fenshi` 三个端点，与前端 `marketService.ts` 接口完全匹配

---

### Task 4: 配置 Vite 代理

**说明:** 修改 `vite.config.ts`，将 `/api` 代理到 `http://localhost:8000`

---

### Task 5: 端到端验证

**说明:** 启动后端 + 前端，确认大盘指数页、个股详情页拉取真实数据

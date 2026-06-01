"""AI交易大师 - 行情数据后端服务"""
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routers import market

app = FastAPI(title="AI Trader API", version="1.0.0")

# CORS - 允许 Vite 前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    print(f"[{response.status_code}] {request.method} {request.url.path} - {elapsed:.3f}s")
    return response

# 注册路由
app.include_router(market.router, prefix="/api/market", tags=["行情"])

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ai-trader-api"}

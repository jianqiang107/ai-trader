"""AI交易大师 - 行情数据后端服务"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import market, user, strategy, signal
from database import init_db
from config import settings
from scheduler.jobs import setup_scheduler
from schemas.common import AppException


# ---------- Lifespan ----------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时建表 + 种子数据 + 启动定时任务"""
    print("[Lifespan] 正在初始化数据库...")
    await init_db()
    print("[Lifespan] 数据库初始化完成")

    # 启动定时任务
    sched = setup_scheduler()
    sched.start()
    print("[Lifespan] 定时任务已启动")

    yield

    # 关闭定时任务
    sched.shutdown()
    print("[Lifespan] 应用关闭")


# ---------- FastAPI 实例 ----------

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

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


# ---------- 全局异常处理 ----------

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """统一业务异常处理"""
    return JSONResponse(
        status_code=200,
        content={"code": exc.code, "data": exc.data, "message": exc.message},
    )


# ---------- 健康检查 ----------

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ai-trader-api", "version": settings.VERSION}


# ---------- 注册路由 ----------

app.include_router(market.router, prefix="/api/market", tags=["行情"])
app.include_router(user.router, prefix="/api")
app.include_router(strategy.router, prefix="/api")
app.include_router(signal.router, prefix="/api")

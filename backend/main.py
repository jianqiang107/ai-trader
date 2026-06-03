"""AI交易大师 - 行情数据后端服务"""
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import ASGIApp, Receive, Scope, Send

from routers import market, user, strategy, signal, news, watchlist
from database import init_db
from config import settings
from scheduler.jobs import setup_scheduler
from schemas.common import AppException


# ---------- 腾讯云代理绝对 URI 修复中间件 ----------

class AbsoluteURIFixMiddleware:
    """修复腾讯云网络代理发送的绝对 URI（//host:port/path → /path）。

    腾讯云的 HTTP 代理会将完整 URL 作为请求路径发送（HTTP 绝对形式），
    导致 FastAPI 路由匹配失败返回 404。此中间件在路由匹配前将
    scope["path"] 从 "//host:port/actual/path" 重写为 "/actual/path"。
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            # 腾讯云代理发送绝对 URI: http://host:port/actual/path
            if path.startswith("http://") or path.startswith("https://"):
                from urllib.parse import urlparse
                parsed = urlparse(path)
                actual_path = parsed.path or "/"
                scope["path"] = actual_path
                scope["raw_path"] = actual_path.encode("utf-8")
        await self.app(scope, receive, send)


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

# CORS - 允许 Vite 前端跨域（先注册，在内层）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 绝对 URI 修复（后注册 = 最外层，在路由匹配前重写路径）
app.add_middleware(AbsoluteURIFixMiddleware)

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
app.include_router(news.router, prefix="/api")
app.include_router(watchlist.router, prefix="/api")


# ---------- 托管前端静态资源（同源部署，消除 HTTPS→HTTP 混合内容问题）----------

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(STATIC_DIR):
    # 静态资源 (/assets/*.js, /assets/*.css)
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # SPA fallback: 非 API 路径回退到 index.html （必须放在最后）
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

    print(f"[Static] 前端静态文件托管已启用: {STATIC_DIR}")

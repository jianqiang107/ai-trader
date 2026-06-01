"""用户路由 — 发送验证码 / 注册 / 登录 / 刷新 Token"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.user import (
    SendCodeRequest,
    RegisterRequest,
    LoginRequest,
    RefreshTokenRequest,
    UserOut,
)
from schemas.common import ApiResponse
from services import user_service
from middleware.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/user", tags=["用户"])


@router.post("/send-code")
async def send_code(req: SendCodeRequest):
    """发送验证码"""
    user_service.send_verify_code(req.phone)
    return ApiResponse(data=None, message="验证码已发送")


@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """注册"""
    try:
        user = await user_service.register(req.phone, req.code, req.nickname, db)
    except ValueError as e:
        return ApiResponse(code=400, data=None, message=str(e))
    return ApiResponse(
        data=UserOut.model_validate(user).model_dump(),
        message="注册成功",
    )


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """登录"""
    try:
        result = await user_service.login(req.phone, req.code, db)
    except ValueError as e:
        return ApiResponse(code=400, data=None, message=str(e))
    return ApiResponse(data=result, message="登录成功")


@router.post("/refresh-token")
async def refresh_token(req: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """刷新 Token"""
    try:
        result = await user_service.refresh_token(req.refresh_token, db)
    except ValueError as e:
        return ApiResponse(code=400, data=None, message=str(e))
    return ApiResponse(data=result, message="刷新成功")

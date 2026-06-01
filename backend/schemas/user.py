"""用户相关 Pydantic Schema

包含：SendCodeRequest, RegisterRequest, LoginRequest, LoginResponse, UserOut, RefreshTokenRequest
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ---------- 请求 ----------

class SendCodeRequest(BaseModel):
    """发送验证码请求"""

    phone: str = Field(..., min_length=11, max_length=11, description="手机号")


class RegisterRequest(BaseModel):
    """注册请求"""

    phone: str = Field(..., min_length=11, max_length=11, description="手机号")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")
    nickname: str = Field(..., min_length=1, max_length=50, description="昵称")


class LoginRequest(BaseModel):
    """登录请求"""

    phone: str = Field(..., min_length=11, max_length=11, description="手机号")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")


class RefreshTokenRequest(BaseModel):
    """刷新 Token 请求"""

    refresh_token: str = Field(..., description="刷新令牌")


# ---------- 响应 ----------

class UserOut(BaseModel):
    """用户信息输出"""

    id: str
    phone: str
    nickname: str | None = None
    avatar: str | None = None
    plan: str = "free"
    plan_expires_at: datetime | None = None
    auto_renew: bool = False

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    """登录成功响应"""

    token: str
    refresh_token: str
    user: UserOut

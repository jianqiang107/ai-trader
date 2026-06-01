"""用户服务 — 验证码、注册、登录、Token 刷新

MVP 阶段验证码使用内存 dict 存储，固定为 123456。
"""

import time
from datetime import datetime, timedelta

from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.user import User, UserAlertSettings

# ---------- 内存验证码存储 ----------
# 格式: {phone: {"code": str, "expires_at": float}}
_verify_codes: dict[str, dict] = {}


def send_verify_code(phone: str) -> None:
    """发送验证码（MVP：固定 123456，写入内存 dict）"""
    expires_at = time.time() + settings.VERIFY_CODE_EXPIRE_MINUTES * 60
    _verify_codes[phone] = {
        "code": settings.VERIFY_CODE,
        "expires_at": expires_at,
    }


def verify_code(phone: str, code: str) -> bool:
    """校验验证码是否正确且未过期"""
    record = _verify_codes.get(phone)
    if record is None:
        return False
    if time.time() > record["expires_at"]:
        # 已过期，清理
        _verify_codes.pop(phone, None)
        return False
    return record["code"] == code


# ---------- Token 签发 ----------

def create_access_token(user_id: str, phone: str, plan: str) -> str:
    """签发 access_token，payload 含 user_id / phone / plan / exp"""
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "user_id": user_id,
        "phone": phone,
        "plan": plan,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """签发 refresh_token，payload 含 user_id / type / exp"""
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "user_id": user_id,
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ---------- 业务方法 ----------

async def register(phone: str, code: str, nickname: str, db: AsyncSession) -> User:
    """注册新用户

    1. 校验验证码
    2. 检查手机号是否已注册
    3. 创建用户 + 默认预警设置
    """
    # 1. 校验验证码
    if not verify_code(phone, code):
        raise ValueError("验证码错误或已过期")

    # 2. 检查手机号是否已注册
    result = await db.execute(select(User).where(User.phone == phone))
    existing_user = result.scalars().first()
    if existing_user is not None:
        raise ValueError("该手机号已注册")

    # 3. 创建用户
    user = User(phone=phone, nickname=nickname, plan="free")
    db.add(user)
    await db.flush()  # 获取 user.id

    # 4. 创建默认预警设置
    alert_settings = UserAlertSettings(user_id=user.id)
    db.add(alert_settings)

    await db.commit()
    await db.refresh(user)
    return user


async def login(phone: str, code: str, db: AsyncSession) -> dict:
    """登录

    1. 校验验证码
    2. 查找用户（手机号未注册则返回错误）
    3. 签发 access_token + refresh_token
    """
    # 1. 校验验证码
    if not verify_code(phone, code):
        raise ValueError("验证码错误或已过期")

    # 2. 查找用户
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalars().first()
    if user is None:
        raise ValueError("该手机号未注册")

    # 3. 签发 Token
    access_token = create_access_token(
        user_id=user.id,
        phone=user.phone,
        plan=user.plan,
    )
    refresh_token_str = create_refresh_token(user_id=user.id)

    return {
        "token": access_token,
        "refresh_token": refresh_token_str,
        "user": {
            "id": user.id,
            "phone": user.phone,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "plan": user.plan,
            "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
            "auto_renew": user.auto_renew,
        },
    }


async def refresh_token(refresh_token_str: str, db: AsyncSession) -> dict:
    """刷新 Token

    1. 解码 refresh_token
    2. 验证 type == "refresh"
    3. 签发新 access_token
    """
    try:
        payload = jwt.decode(
            refresh_token_str,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise ValueError("refresh_token 无效或已过期")

    # 验证 token 类型
    if payload.get("type") != "refresh":
        raise ValueError("非 refresh_token，无法刷新")

    user_id: str | None = payload.get("user_id")
    if user_id is None:
        raise ValueError("refresh_token 中缺少 user_id")

    # 查找用户
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise ValueError("用户不存在")

    # 签发新 access_token
    new_access_token = create_access_token(
        user_id=user.id,
        phone=user.phone,
        plan=user.plan,
    )
    new_refresh_token = create_refresh_token(user_id=user.id)

    return {
        "token": new_access_token,
        "refresh_token": new_refresh_token,
    }

"""用户服务 — 验证码、注册、登录、Token 刷新"""

import logging
import secrets
import time
from datetime import datetime, timedelta

from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.user import User, UserAlertSettings

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# ---------- 内存验证码存储 ----------
# 格式: {phone: {"code": str, "expires_at": float}}
_verify_codes: dict[str, dict] = {}


class SmsProviderNotConfigured(ValueError):
    """短信服务未正确配置。"""


class SmsProvider:
    """可替换短信发送接口。"""

    def send_code(self, phone: str, code: str) -> None:
        raise NotImplementedError


class MockSmsProvider(SmsProvider):
    """仅用于本地/测试环境的短信发送器。"""

    def send_code(self, phone: str, code: str) -> None:
        if not settings.ALLOW_MOCK_SMS:
            raise SmsProviderNotConfigured("生产环境未配置短信服务，无法发送验证码")
        logger.info("mock sms code generated for %s: %s", phone, code)


class TencentSmsProvider(SmsProvider):
    """腾讯云短信占位适配器；配置真实 SDK 后替换 send_code 实现。"""

    def send_code(self, phone: str, code: str) -> None:
        required = [
            settings.SMS_API_KEY,
            settings.SMS_API_SECRET,
            settings.SMS_SIGN_NAME,
            settings.SMS_TEMPLATE_ID,
        ]
        if not all(required):
            raise SmsProviderNotConfigured("腾讯云短信服务未配置完整，无法发送验证码")
        raise SmsProviderNotConfigured("腾讯云短信发送器尚未接入 SDK，请完成 provider 实现")


def _generate_verify_code() -> str:
    """生成指定长度的数字验证码。"""
    length = max(settings.VERIFY_CODE_LENGTH, 4)
    lower_bound = 10 ** (length - 1)
    upper_bound = 10 ** length
    return str(lower_bound + secrets.randbelow(upper_bound - lower_bound))


def _get_sms_provider() -> SmsProvider:
    provider = settings.SMS_PROVIDER.lower()
    if provider == "mock":
        return MockSmsProvider()
    if provider == "tencent":
        return TencentSmsProvider()
    raise SmsProviderNotConfigured("短信服务未配置，无法发送验证码")


def send_verify_code(phone: str) -> str | None:
    """发送验证码，生产环境必须配置真实短信服务。"""
    code = _generate_verify_code()
    _get_sms_provider().send_code(phone, code)
    expires_at = time.time() + settings.VERIFY_CODE_EXPIRE_MINUTES * 60
    _verify_codes[phone] = {
        "code": code,
        "expires_at": expires_at,
    }
    if settings.ALLOW_MOCK_SMS and settings.SMS_PROVIDER.lower() == "mock":
        return code
    return None


def verify_code(phone: str, code: str) -> bool:
    """校验验证码是否正确且未过期"""
    record = _verify_codes.get(phone)
    if record is None:
        return False
    if time.time() > record["expires_at"]:
        # 已过期，清理
        _verify_codes.pop(phone, None)
        return False
    if record["code"] != code:
        return False
    _verify_codes.pop(phone, None)
    return True


# ---------- Token 签发 ----------


def hash_password(password: str) -> str:
    """生成密码哈希。"""
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """校验明文密码和哈希是否匹配。"""
    if not password_hash:
        return False
    return pwd_context.verify(password, password_hash)


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

async def register(phone: str, password: str, nickname: str, db: AsyncSession) -> User:
    """注册新用户

    1. 检查手机号是否已注册
    2. 创建用户 + 默认预警设置
    """
    # 1. 检查手机号是否已注册
    result = await db.execute(select(User).where(User.phone == phone))
    existing_user = result.scalars().first()
    if existing_user is not None:
        raise ValueError("该手机号已注册")

    # 2. 创建用户
    user = User(phone=phone, password_hash=hash_password(password), nickname=nickname, plan="free")
    db.add(user)
    await db.flush()  # 获取 user.id

    # 4. 创建默认预警设置
    alert_settings = UserAlertSettings(user_id=user.id)
    db.add(alert_settings)

    await db.commit()
    await db.refresh(user)
    return user


async def login(phone: str, password: str, db: AsyncSession) -> dict:
    """登录

    1. 查找用户
    2. 校验密码
    3. 签发 access_token + refresh_token
    """
    # 1. 查找用户
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalars().first()
    if user is None or not verify_password(password, user.password_hash):
        raise ValueError("账号或密码错误")

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

"""JWT 认证中间件 & 权限校验"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.user import User

security = HTTPBearer()

PLAN_LEVELS = {"free": 0, "pro": 1, "flagship": 2}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """从 JWT Token 中解析当前用户"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str | None = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def has_permission(user_plan: str, required_plan: str) -> bool:
    """检查用户会员等级是否满足要求"""
    return PLAN_LEVELS.get(user_plan, 0) >= PLAN_LEVELS.get(required_plan, 0)


def require_plan(required_plan: str):
    """依赖注入：要求用户具有指定会员等级"""
    async def _check(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user.plan, required_plan):
            raise HTTPException(status_code=403, detail=f"需要 {required_plan} 及以上会员")
        return user
    return _check

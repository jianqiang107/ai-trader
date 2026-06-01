"""ORM 基类与公共 Mixin

使用 SQLAlchemy 2.0 声明式风格：Mapped + mapped_column
"""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# 重新导出 Base，统一入口
from database import Base  # noqa: F401


class TimestampMixin:
    """时间戳混入，为模型自动添加 created_at / updated_at"""

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


def generate_uuid() -> str:
    """生成 UUID 字符串，用作主键默认值"""
    return str(uuid.uuid4())

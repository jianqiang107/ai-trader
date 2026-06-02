"""用户相关 ORM 模型

包含：User, UserAlertSettings, UserWatchlist, Notification
"""

from datetime import datetime

from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin, generate_uuid


class User(Base, TimestampMixin):
    """用户表"""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    nickname: Mapped[str | None] = mapped_column(String(50), nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    plan_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    auto_renew: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 关系
    alert_settings: Mapped["UserAlertSettings | None"] = relationship(
        "UserAlertSettings", back_populates="user", uselist=False, lazy="selectin"
    )
    watchlist: Mapped[list["UserWatchlist"]] = relationship(
        "UserWatchlist", back_populates="user", lazy="selectin"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="user", lazy="selectin"
    )
    subscriptions: Mapped[list["UserSubscription"]] = relationship(
        "UserSubscription", back_populates="user", lazy="selectin"
    )


class UserAlertSettings(Base):
    """用户预警设置 — 每用户一条"""

    __tablename__ = "user_alert_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    stop_loss_pct: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    take_profit_pct: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    alert_method: Mapped[str] = mapped_column(String(20), default="push", nullable=False)
    alert_frequency: Mapped[str] = mapped_column(String(20), default="realtime", nullable=False)

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="alert_settings")


class UserWatchlist(Base):
    """用户自选股"""

    __tablename__ = "user_watchlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stock_code: Mapped[str] = mapped_column(String(20), nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="watchlist")


class Notification(Base):
    """用户通知"""

    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="notifications")

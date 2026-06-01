"""策略相关 ORM 模型

包含：Strategy, UserSubscription
"""

from datetime import datetime

from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin, generate_uuid


class Strategy(Base, TimestampMixin):
    """策略表"""

    __tablename__ = "strategies"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_return: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    win_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_drawdown: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sharpe_ratio: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sortino_ratio: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    calmar_ratio: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    running_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    signal_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    required_plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 关系
    subscriptions: Mapped[list["UserSubscription"]] = relationship(
        "UserSubscription", back_populates="strategy", lazy="selectin"
    )
    signals: Mapped[list["Signal"]] = relationship(
        "Signal", back_populates="strategy", lazy="selectin"
    )
    factors: Mapped[list["FactorState"]] = relationship(
        "FactorState", back_populates="strategy", lazy="selectin"
    )


class UserSubscription(Base):
    """用户策略订阅"""

    __tablename__ = "user_subscriptions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    strategy_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscribed_at: Mapped[datetime] = mapped_column(
        DateTime, server_default="CURRENT_TIMESTAMP", nullable=False
    )

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="subscriptions")  # noqa: F821
    strategy: Mapped["Strategy"] = relationship("Strategy", back_populates="subscriptions")

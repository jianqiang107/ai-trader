"""信号 ORM 模型

包含：Signal
"""

from datetime import datetime

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin, generate_uuid


class Signal(Base, TimestampMixin):
    """交易信号表"""

    __tablename__ = "signals"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    stock_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    stock_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    signal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    strategy_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("strategies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    signal_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    signal_price: Mapped[float] = mapped_column(Float, nullable=False)
    mode: Mapped[str] = mapped_column(String(20), default="simulated", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    stop_loss_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    take_profit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    alert_status: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    actual_pnl: Mapped[float | None] = mapped_column(Float, nullable=True)

    # 关系
    strategy: Mapped["Strategy | None"] = relationship("Strategy", back_populates="signals")  # noqa: F821

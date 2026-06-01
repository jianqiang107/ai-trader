"""因子状态 ORM 模型

包含：FactorState
"""

from datetime import datetime

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class FactorState(Base):
    """策略因子状态快照"""

    __tablename__ = "factor_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    strategy_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    change: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="neutral", nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default="CURRENT_TIMESTAMP", nullable=False
    )

    # 关系
    strategy: Mapped["Strategy"] = relationship("Strategy", back_populates="factors")  # noqa: F821

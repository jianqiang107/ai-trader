"""策略相关 Pydantic Schema

包含：StrategyOut, FactorStateOut, PerformanceOut
"""

from pydantic import BaseModel, Field


class StrategyOut(BaseModel):
    """策略详情输出"""

    id: str
    name: str
    type: str
    description: str | None = None
    total_return: float = 0.0
    win_rate: float = 0.0
    max_drawdown: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    running_days: int = 0
    signal_count: int = 0
    required_plan: str = "free"
    is_active: bool = True
    is_subscribed: bool = False

    model_config = {"from_attributes": True}


class FactorStateOut(BaseModel):
    """因子状态输出"""

    label: str
    value: float = 0.0
    change: float = 0.0
    status: str = "neutral"

    model_config = {"from_attributes": True}


class PerformanceOut(BaseModel):
    """策略绩效曲线输出"""

    dates: list[str] = Field(default_factory=list, description="日期序列")
    strategy_values: list[float] = Field(default_factory=list, description="策略净值序列")
    benchmark_values: list[float] = Field(default_factory=list, description="基准净值序列")
    total_return: float = 0.0
    max_drawdown: float = 0.0
    sharpe_ratio: float = 0.0
    trades: list[dict] = Field(default_factory=list, description="交易记录列表")

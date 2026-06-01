"""信号相关 Pydantic Schema

包含：SignalOut, AlertSettingIn, LiveSignalFilter, LiveSignalStatsOut, EmotionDataOut, EmotionFlowDataOut
"""

from datetime import datetime

from pydantic import BaseModel, Field


class SignalOut(BaseModel):
    """信号详情输出"""

    id: str
    stock_code: str
    stock_name: str | None = None
    signal_type: str
    strategy_id: str | None = None
    signal_time: datetime
    signal_price: float = 0.0
    mode: str = "simulated"
    confidence: float = 0.0
    status: str = "pending"
    stop_loss_price: float | None = None
    take_profit_price: float | None = None
    alert_status: str = "none"
    actual_pnl: float | None = None
    holding_days: int | None = Field(None, description="持仓天数（计算字段）")
    current_price: float | None = Field(None, description="当前价格（计算字段）")
    floating_pnl: float | None = Field(None, description="浮动盈亏百分比（计算字段）")

    model_config = {"from_attributes": True}


class AlertSettingIn(BaseModel):
    """预警设置输入"""

    stop_loss_price: float | None = Field(None, description="止损价")
    take_profit_price: float | None = Field(None, description="止盈价")
    alert_method: str = Field("push", description="预警方式: push | sms | email")
    alert_frequency: str = Field("realtime", description="预警频率: realtime | daily | weekly")


class LiveSignalFilter(BaseModel):
    """实时信号筛选条件"""

    type: str | None = Field(None, description="信号类型筛选")
    period: str | None = Field(None, description="时间周期: today | week | month")
    search: str | None = Field(None, description="股票代码/名称搜索")
    onlyHolding: bool = Field(False, description="仅显示持仓中")
    onlyAlerting: bool = Field(False, description="仅显示预警中")


class LiveSignalStatsOut(BaseModel):
    """实时信号统计"""

    today_count: int = 0
    holding: int = 0
    take_profit: int = 0
    stop_loss: int = 0
    alerting: int = 0


class EmotionDataOut(BaseModel):
    """市场情绪数据点"""

    date: str
    value: float = 0.0


class EmotionFlowDataOut(BaseModel):
    """市场情绪资金流数据点"""

    date: str
    inflow: float = 0.0
    outflow: float = 0.0

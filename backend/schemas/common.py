"""统一响应格式 Schema & 业务异常"""

from pydantic import BaseModel
from typing import TypeVar, Generic

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """统一 API 响应包装"""

    code: int = 0
    data: T | None = None
    message: str = "ok"
    source: str | None = None


class AppException(Exception):
    """业务异常基类

    用于服务层抛出结构化业务错误，由 main.py 全局异常处理器统一捕获。
    """

    def __init__(self, code: int = 400, message: str = "请求失败", data: object = None):
        self.code = code
        self.message = message
        self.data = data

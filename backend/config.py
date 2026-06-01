"""AI交易大师 - 全局配置"""

import os


class Settings:
    """应用配置项，生产环境通过环境变量覆盖"""

    PROJECT_NAME: str = "AI Trader API"
    VERSION: str = "1.0.0"
    DATABASE_URL: str = "sqlite+aiosqlite:///./ai_trader.db"
    JWT_SECRET: str = os.getenv("JWT_SECRET", "ai-trader-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # 2小时
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    VERIFY_CODE: str = "123456"  # MVP mock
    VERIFY_CODE_EXPIRE_MINUTES: int = 5

    # 管理员种子账号
    ADMIN_PHONE: str = os.getenv("ADMIN_PHONE", "13800000001")
    ADMIN_NICKNAME: str = os.getenv("ADMIN_NICKNAME", "Admin")
    ADMIN_PLAN: str = "flagship"  # 最高权限


settings = Settings()

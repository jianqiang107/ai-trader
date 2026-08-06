"""AI交易大师 - 全局配置"""

import os


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


class Settings:
    """应用配置项，生产环境通过环境变量覆盖"""

    PROJECT_NAME: str = "AI Trader API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:////tmp/ai_trader.db"
        if os.getenv("VERCEL") == "1"
        else "sqlite+aiosqlite:///./ai_trader.db",
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET", "ai-trader-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # 2小时
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    VERIFY_CODE_EXPIRE_MINUTES: int = int(os.getenv("VERIFY_CODE_EXPIRE_MINUTES", "5"))
    VERIFY_CODE_LENGTH: int = int(os.getenv("VERIFY_CODE_LENGTH", "6"))

    # 短信服务配置。生产环境默认禁用 mock，必须接入真实短信提供商。
    SMS_PROVIDER: str = os.getenv("SMS_PROVIDER", "mock")
    SMS_API_KEY: str = os.getenv("SMS_API_KEY", "")
    SMS_API_SECRET: str = os.getenv("SMS_API_SECRET", "")
    SMS_SIGN_NAME: str = os.getenv("SMS_SIGN_NAME", "")
    SMS_TEMPLATE_ID: str = os.getenv("SMS_TEMPLATE_ID", "")
    ALLOW_MOCK_SMS: bool = _env_bool(
        "ALLOW_MOCK_SMS",
        os.getenv("ENVIRONMENT", "development") != "production",
    )

    # 管理员种子账号
    ADMIN_PHONE: str = os.getenv("ADMIN_PHONE", "13800000001")
    ADMIN_NICKNAME: str = os.getenv("ADMIN_NICKNAME", "Admin")
    ADMIN_PLAN: str = "flagship"  # 最高权限
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")


settings = Settings()

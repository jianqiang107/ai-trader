"""AI交易大师 - 数据库连接配置

使用 SQLAlchemy 2.0 async + aiosqlite
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from config import settings

# 异步引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
)

# 异步会话工厂
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """ORM 声明式基类，由 models/base.py 重新导出"""
    pass


async def get_db() -> AsyncSession:
    """FastAPI 依赖注入：获取异步数据库会话"""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """建表 + 种子数据（MVP 不用 Alembic）"""
    # 确保所有模型被导入，使 Base.metadata 感知所有表
    import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 插入种子数据
    await _seed_admin_user()
    await _seed_strategies()


async def _seed_admin_user() -> None:
    """当 users 表无 admin 时，创建管理员种子账号 + 默认预警设置 + 订阅所有策略"""
    from sqlalchemy import select
    from models.user import User, UserAlertSettings
    from models.strategy import UserSubscription
    from config import settings

    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.phone == settings.ADMIN_PHONE)
        )
        if result.scalars().first() is not None:
            return  # 已存在，跳过

        admin = User(
            phone=settings.ADMIN_PHONE,
            nickname=settings.ADMIN_NICKNAME,
            plan=settings.ADMIN_PLAN,
            auto_renew=True,
        )
        session.add(admin)
        await session.flush()  # 拿到 admin.id

        # 默认预警设置
        session.add(UserAlertSettings(
            user_id=admin.id,
            stop_loss_pct=5.0,
            take_profit_pct=10.0,
            alert_method="push",
            alert_frequency="realtime",
        ))

        await session.commit()
        print(f"[DB] 已创建管理员账号: {settings.ADMIN_PHONE} ({settings.ADMIN_PLAN})")


async def _seed_strategies() -> None:
    """当 strategies 表为空时，插入 4 条默认策略"""
    from sqlalchemy import select
    from models.strategy import Strategy

    async with async_session() as session:
        result = await session.execute(select(Strategy).limit(1))
        if result.scalars().first() is not None:
            return  # 已有数据，跳过

        default_strategies = [
            Strategy(
                id="strategy-dxyh-001",
                name="低吸一号",
                type="低吸",
                description="基于超跌反弹逻辑，在股价短期跌幅过大时寻找低吸机会，适合震荡市和下跌市中的抄底操作。",
                total_return=0.186,
                win_rate=0.62,
                max_drawdown=0.08,
                sharpe_ratio=1.35,
                sortino_ratio=1.78,
                calmar_ratio=1.52,
                running_days=365,
                signal_count=128,
                required_plan="free",
                is_active=True,
            ),
            Strategy(
                id="strategy-qsyh-001",
                name="趋势一号",
                type="趋势",
                description="基于均线趋势跟踪，在股价形成明确上升通道时入场，适合牛市和趋势行情中的波段操作。",
                total_return=0.342,
                win_rate=0.55,
                max_drawdown=0.12,
                sharpe_ratio=1.68,
                sortino_ratio=2.15,
                calmar_ratio=1.89,
                running_days=365,
                signal_count=96,
                required_plan="pro",
                is_active=True,
            ),
            Strategy(
                id="strategy-tpyh-001",
                name="突破一号",
                type="突破",
                description="基于箱体突破与量价配合，在股价突破关键阻力位时入场，适合捕捉主升浪行情。",
                total_return=0.428,
                win_rate=0.48,
                max_drawdown=0.15,
                sharpe_ratio=1.92,
                sortino_ratio=2.45,
                calmar_ratio=2.18,
                running_days=365,
                signal_count=72,
                required_plan="pro",
                is_active=True,
            ),
            Strategy(
                id="strategy-jjhg-001",
                name="均值回归一号",
                type="均值回归",
                description="基于统计套利思想，在股价偏离均值过大时反向操作，适合量化风格投资者。",
                total_return=0.256,
                win_rate=0.58,
                max_drawdown=0.06,
                sharpe_ratio=2.15,
                sortino_ratio=2.82,
                calmar_ratio=2.45,
                running_days=365,
                signal_count=156,
                required_plan="flagship",
                is_active=True,
            ),
        ]
        session.add_all(default_strategies)
        await session.commit()
        print("[DB] 已插入 4 条默认策略种子数据")

    # 管理员自动订阅所有策略
    await _subscribe_admin_all_strategies()


async def _subscribe_admin_all_strategies() -> None:
    """管理员账号自动订阅所有活跃策略"""
    from sqlalchemy import select
    from models.user import User
    from models.strategy import Strategy, UserSubscription
    from config import settings

    async with async_session() as session:
        admin_result = await session.execute(
            select(User).where(User.phone == settings.ADMIN_PHONE)
        )
        admin = admin_result.scalars().first()
        if admin is None:
            return

        # 查所有策略
        strategies_result = await session.execute(select(Strategy))
        strategies = strategies_result.scalars().all()

        # 查已有订阅
        sub_result = await session.execute(
            select(UserSubscription).where(UserSubscription.user_id == admin.id)
        )
        existing = {s.strategy_id for s in sub_result.scalars().all()}

        new_subs = []
        for s in strategies:
            if s.id not in existing:
                new_subs.append(UserSubscription(user_id=admin.id, strategy_id=s.id))

        if new_subs:
            session.add_all(new_subs)
            await session.commit()
            print(f"[DB] 管理员已自动订阅 {len(new_subs)} 个策略")

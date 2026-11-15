from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

from app.core.settings import get_settings
from app.db.models import *  # noqa: F401, F403
from app.db.session import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _sync_url(url: str) -> str:
    """Convert async driver prefix to sync for Alembic."""
    return url.replace("postgresql+psycopg://", "postgresql+psycopg://")


def run_migrations_offline() -> None:
    url = str(get_settings().database_url)
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = str(get_settings().database_url)
    engine = create_engine(url)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

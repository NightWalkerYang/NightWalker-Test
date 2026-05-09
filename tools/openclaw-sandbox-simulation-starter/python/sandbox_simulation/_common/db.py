"""
sandbox_simulation 公共数据库工厂。

环境变量：
  SANDBOX_PG_DSN     - 完整 SQLAlchemy DSN
  SANDBOX_PG_SCHEMA  - 默认 sandbox_v1

调用示例：
  from sandbox_simulation._common.db import get_engine, get_schema
  engine = get_engine()
  schema = get_schema()
"""

from __future__ import annotations

import os
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


DEFAULT_SCHEMA = "sandbox_v1"


@lru_cache(maxsize=4)
def get_engine(dsn: str | None = None) -> Engine:
    resolved_dsn = dsn or os.environ["SANDBOX_PG_DSN"]
    return create_engine(
        resolved_dsn,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )


def get_schema() -> str:
    return os.environ.get("SANDBOX_PG_SCHEMA", DEFAULT_SCHEMA)

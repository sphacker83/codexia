from __future__ import annotations

import os

from psycopg import connect
from psycopg.rows import dict_row


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for snapshot writer.")
    return database_url


def get_connection():
    return connect(get_database_url(), row_factory=dict_row)

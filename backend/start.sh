#!/bin/sh
set -e

echo "Running database migrations..."
# Use unpooled connection for migrations — PgBouncer pooler does not support DDL
if [ -n "$DATABASE_URL_UNPOOLED" ]; then
  DATABASE_URL="$DATABASE_URL_UNPOOLED" alembic upgrade head
else
  alembic upgrade head
fi

echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

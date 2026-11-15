FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

FROM base AS builder
RUN pip install --no-cache-dir --upgrade pip setuptools
COPY pyproject.toml .
COPY app ./app
RUN pip install --no-cache-dir ".[dev]"

FROM base AS runtime
RUN pip install --no-cache-dir --upgrade pip setuptools
COPY pyproject.toml .
COPY app ./app
RUN pip install --no-cache-dir .
COPY . .
RUN chmod +x start.sh
EXPOSE 8000
CMD ["./start.sh"]

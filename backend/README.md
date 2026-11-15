# NextCrop Backend

> Production-ready FastAPI service for crop advisory data.

Satellite-informed crop rotation advice for smallholder farmers in the Lango sub-region, Uganda.

## Stack

| Component | Technology |
|-----------|-----------|
| API | Python 3.12, FastAPI, Pydantic v2 |
| Database | PostgreSQL 16 + PostGIS, SQLAlchemy 2.0, Alembic |
| Queue / Scheduler | Celery + Redis |
| Rule engine | Pure Python, YAML packs, JSON Schema |
| Auth | OTP via SMS, short-lived JWT |
| Observability | structlog, Prometheus, Sentry |
| Infrastructure | Docker, Docker Compose, Terraform |

## Quick start (development)

```bash
cp .env.example .env
# Edit .env — set SECRET_KEY and MSISDN_PEPPER to random 32+ char strings

docker compose up -d db redis
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/v1/docs

## Run tests

```bash
pytest                          # unit + golden + property tests
pytest tests/golden/            # golden tests only
pytest tests/integration/       # integration tests (requires running db + redis)
```

## Live vs sample data

| Feature | Release 0 (hackathon) | Release 1 (pilot) |
|---------|----------------------|-------------------|
| NASA POWER rainfall | ✅ Live (Lira grid cell) | ✅ Live (full pilot grid) |
| NASA SMAP soil moisture | ⚠️ Sample / fallback | ✅ Live |
| NASA MODIS NDVI | ❌ Not included | ✅ Live |
| GPM IMERG | ❌ Not included | ✅ Live |
| Climatology (20yr baseline) | ⚠️ Partial (POWER only) | ✅ Full |
| Rule pack | ✅ v2.0 (agronomist-reviewed) | ✅ v2.0+ |
| OTP / SMS | ❌ Dev log only | ✅ Live via aggregator |
| USSD | ⚠️ Simulated | ✅ Live on network |
| User accounts | ❌ Anonymous | ✅ Full |

**Honest limits (SRS 2.7):** All outputs carry a confidence label. The system never claims
plot-level soil measurement. Data resolution is regional (~0.5° POWER, ~9 km SMAP).
When data is missing or stale the API says so and still returns a safe rule-based answer.

## Architecture

```
NASA POWER / SMAP / MODIS / IMERG
        │
        ▼ (nightly Celery beat)
  ingestion workers
        │
        ▼
  climate_daily (PostGIS)
        │
        ▼
  outlook engine ──► outlook snapshots
        │
        ▼
  rule engine (pure Python, no I/O)
        │
        ▼
  REST API /v1  ──► web PWA / USSD / SMS
```

## Directory layout

```
app/
  api/v1/          # routers: health, outlook, recommendations, plots, auth,
                   #          ussd, feedback, extension, admin, reports
  core/            # settings, security, logging, errors
  domain/
    rules/         # pure rule engine, pack loader, schema
    outlook/       # moisture gate, onset, dry spells, confidence
  ingestion/       # power.py, quality.py
  channels/        # ussd state machine, sms segment counter
  db/              # models, session, migrations/
  workers/         # celery app and tasks
rulepacks/         # versioned YAML + JSON Schema
i18n/              # SMS catalogues (en, laj)
tests/
  unit/            # engine, outlook, sms, security
  golden/          # GT-01 to GT-12
  integration/     # API with real db + redis
infra/             # terraform, runbooks
```

## Rule pack lifecycle

1. Agronomist creates a draft via `POST /v1/admin/rule-packs`
2. Submits for review: `POST /v1/admin/rule-packs/{id}/submit-review`
3. A **different** person approves: `POST /v1/admin/rule-packs/{id}/approve`
4. Admin publishes (golden tests must pass): `POST /v1/admin/rule-packs/{id}/publish`
5. Rollback if needed: `POST /v1/admin/rule-packs/{id}/rollback`

All actions are recorded in the append-only `audit_log` table.

## Security

- Secrets never in the repo — loaded from environment / secret manager at runtime
- MSISDN stored as HMAC-SHA256 with a pepper (not plain hash)
- OTP: 6 digits, 5-minute expiry, 3 attempts max, 5/hour per number, Uganda allow-list
- USSD/SMS webhooks: IP allow-list + shared secret + replay protection
- Audit log is immutable (database trigger blocks UPDATE/DELETE)
- No personal data in logs (structlog PII redaction processor)

## Disclaimer

This system provides regional climate-informed crop rotation advice. It is not a substitute
for advice from a qualified extension officer. Actual conditions on individual plots may differ
from regional satellite data.

## Environment Variables
Copy `.env.example` to `.env` and fill in the required values before running.

## Running Tests
```
pytest tests/
```

## Docker
```
docker compose up --build
```

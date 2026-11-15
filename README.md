# NextCrop

> Satellite-informed crop rotation advice for smallholder farmers in the Lango sub-region, Uganda.

**Live demo:** https://nextcrop-web.onrender.com · **API:** https://nextcrop-api.onrender.com/v1/docs

---

## What it does

NextCrop answers one question for a smallholder farmer: *what should I plant next season?*

It combines NASA Earth observation data (rainfall, soil moisture, season onset) with an agronomist-reviewed rule pack to produce a 4-season crop rotation plan. The plan explains every choice and flags risks. It works on the web and over USSD for farmers without smartphones.

---

## Architecture

```
NASA POWER / SMAP / MODIS / IMERG
        │
        ▼  (nightly ingestion)
  climate_daily  (PostGIS, Neon)
        │
        ▼
  outlook engine  ──►  outlook snapshots
        │
        ▼
  rule engine  (pure Python, YAML packs)
        │
        ▼
  FastAPI  /v1  ──►  React PWA  /  USSD  /  SMS
```

### Services (Render Blueprint)

| Service | Type | URL |
|---------|------|-----|
| `nextcrop-api` | Docker (Python 3.12 / FastAPI) | https://nextcrop-api.onrender.com |
| `nextcrop-web` | Static site (React / Vite) | https://nextcrop-web.onrender.com |
| `nextcrop-redis` | Redis (free) | internal |
| Neon | PostgreSQL 18 + PostGIS | external (pooled + unpooled) |

---

## Repository layout

```
NextCrop/
├── backend/                   # FastAPI service
│   ├── app/
│   │   ├── api/v1/            # health, outlook, recommendations, plots,
│   │   │                      # auth, ussd, feedback, extension, admin,
│   │   │                      # reports, translations
│   │   ├── core/              # settings, security, logging, errors
│   │   ├── domain/
│   │   │   ├── rules/         # pure rule engine + YAML pack loader
│   │   │   └── outlook/       # moisture gate, onset, dry spells
│   │   ├── ingestion/         # NASA POWER, SMAP, MODIS, quality checks
│   │   ├── channels/          # USSD state machine, SMS templates
│   │   ├── db/                # SQLAlchemy models, Alembic migrations
│   │   └── workers/           # Celery tasks (data ingestion, SMS)
│   ├── rulepacks/
│   │   ├── lango-rotation.yaml   # v2.0 agronomist-reviewed rule pack
│   │   └── schema.json           # JSON Schema for pack validation
│   ├── i18n/sms.yaml          # SMS catalogues (en, laj — Lango language)
│   ├── scripts/
│   │   ├── provision_staff.py # CLI to create admin / officer accounts
│   │   └── agronomic_validation.py
│   ├── tests/
│   │   ├── unit/              # rule engine, outlook, security
│   │   ├── golden/            # GT-01 to GT-12 deterministic cases
│   │   ├── integration/       # API with real db + redis
│   │   └── load/              # Locust load tests
│   ├── infra/
│   │   ├── terraform/         # cloud infrastructure
│   │   └── runbooks/
│   ├── Dockerfile
│   ├── start.sh               # runs alembic upgrade head then uvicorn
│   └── pyproject.toml
├── frontend/                  # React PWA
│   ├── apps/web/              # Vite app
│   │   └── src/pages/         # WelcomePage, ClimatePage, WizardPage,
│   │                          # PlanPage, PlotsPage, SignInPage,
│   │                          # AdminOfficerApprovalsPage, …
│   ├── packages/
│   │   ├── api-client/        # typed fetch client for /v1
│   │   ├── i18n/              # ICU message catalogues (en)
│   │   ├── ui/                # shared component library
│   │   └── testing/           # shared test utilities
│   └── e2e/smoke.spec.ts      # Playwright smoke tests
├── render.yaml                # Render Blueprint (all services)
├── neon.ts                    # Neon database config
└── README.md
```

---

## Tech stack

### Backend

| Layer | Technology |
|-------|-----------|
| API | Python 3.12, FastAPI 0.163, Pydantic v2 |
| Database | PostgreSQL 18 (Neon) + PostGIS, SQLAlchemy 2 (async), Alembic |
| Cache / Queue | Redis, Celery |
| Rule engine | Pure Python, YAML packs, JSON Schema validation |
| Auth | Phone-number sign-in, OTP via SMS, short-lived JWT + refresh tokens |
| Climate data | NASA POWER (rainfall), NASA SMAP (soil moisture), MODIS, IMERG |
| Observability | structlog, Prometheus, Sentry, OpenTelemetry |
| Testing | pytest, pytest-asyncio, Hypothesis, testcontainers, Locust |
| Linting | ruff, mypy (strict), bandit, pip-audit |

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | React 18, TypeScript, Vite |
| Routing | React Router v6 |
| Data fetching | TanStack Query |
| Internationalisation | ICU message format, custom i18n package |
| Testing | Vitest, Playwright |
| Deployment | Render static site, PWA (service worker, offline support) |

---

## Quick start

### Backend

```bash
cd backend
cp .env.example .env
# Set SECRET_KEY and MSISDN_PEPPER to random 32+ char strings

docker compose up -d db redis
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/v1/docs

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

App: http://localhost:5173

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Pooled PostgreSQL URL (psycopg3 driver) |
| `DATABASE_URL_UNPOOLED` | ✅ | Direct URL for Alembic migrations (bypasses PgBouncer) |
| `REDIS_URL` | ✅ | Redis connection string |
| `SECRET_KEY` | ✅ | JWT signing key (32+ chars) |
| `MSISDN_PEPPER` | ✅ | HMAC pepper for phone number hashing |
| `ENVIRONMENT` | ✅ | `development` or `production` |
| `SMS_PROVIDER_URL` | optional | SMS aggregator endpoint |
| `SMS_API_KEY` | optional | SMS aggregator key |
| `EARTHDATA_USERNAME` | optional | NASA Earthdata login for SMAP/MODIS |
| `EARTHDATA_PASSWORD` | optional | NASA Earthdata password |
| `SENTRY_DSN` | optional | Sentry error tracking |
| `CORS_ORIGINS` | optional | JSON array of allowed origins |

---

## API endpoints

All routes are prefixed `/v1`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + data freshness |
| GET | `/outlook` | Season context (rainfall, moisture, onset) |
| POST | `/recommendations` | Generate crop rotation plan |
| GET/POST | `/plots` | Farmer plot management |
| POST | `/auth/phone` | Sign in / sign up by phone number |
| POST | `/auth/otp/request` | Request OTP code via SMS |
| POST | `/auth/otp/verify` | Verify OTP and get session |
| POST | `/auth/refresh` | Rotate refresh token |
| GET | `/auth/me` | Current user profile |
| DELETE | `/auth/session` | Sign out |
| POST | `/auth/consent` | Record data consent |
| GET | `/admin/officer-registrations` | List pending officer sign-ups |
| POST | `/admin/officer-registrations/{id}/approve` | Approve officer |
| POST | `/admin/officer-registrations/{id}/reject` | Reject officer |
| POST | `/ussd` | USSD gateway webhook |
| GET | `/reports/*` | Anonymised usage reports |

---

## User roles

| Role | How created | Access |
|------|-------------|--------|
| Farmer | Self-registration | Own plots, plans, season outlook |
| Extension officer | Self-registration → admin approval | Field workspace, farmer registration, observations |
| Admin | Provisioned via `scripts/provision_staff.py` | Full platform: users, rule packs, reports, audit log |

### Provision an admin account

```bash
python scripts/provision_staff.py \
  --phone +256770000001 \
  --name "Grace Akello" \
  --role admin \
  --district lira \
  --constituency "Lira Central" \
  --subcounty "Adyel"
```

---

## Rule pack

The active pack is `rulepacks/lango-rotation.yaml` (v2.0, agronomist-reviewed).

**Crops covered:** maize, sorghum, finger millet, soya, groundnut, bean, cowpea, simsim, sunflower, cassava

**Hard rules (HR-01 – HR-10):** cereal-after-cereal ban, striga cereal ban, cassava disease rest, groundnut disease skip, bean on sandy soil, maize in dry season, simsim in wet season, season gate exclusions, cassava 2-season block, legume-after-legume ban.

**Soft rules (SR-01 – SR-03):** armyworm maize priority reduction, low-fertility legume-first warning, legume rotation discount.

**Goals:** `restore_soil`, `max_cash`, `drought_survival` — each with per-crop weights.

**Languages:** English (`en`) and Lango (`laj`) for all rule messages and SMS templates.

### Rule pack lifecycle

1. Agronomist drafts via `POST /v1/admin/rule-packs`
2. Submits for review → `POST /v1/admin/rule-packs/{id}/submit-review`
3. Different person approves → `POST /v1/admin/rule-packs/{id}/approve`
4. Admin publishes (golden tests must pass) → `POST /v1/admin/rule-packs/{id}/publish`
5. Rollback if needed → `POST /v1/admin/rule-packs/{id}/rollback`

All actions are recorded in the append-only `audit_log` table.

---

## Tests

```bash
cd backend

pytest                          # unit + golden + property tests
pytest tests/golden/            # GT-01 to GT-12 deterministic cases
pytest tests/integration/       # requires running db + redis
pytest tests/load/              # Locust load tests
```

```bash
cd frontend

npm test                        # Vitest unit tests
npx playwright test             # Playwright e2e smoke tests
```

---

## Deployment (Render)

The `render.yaml` Blueprint defines all services. On every push to `main`, Render rebuilds automatically.

```
main branch push
    │
    ├── nextcrop-api  →  Docker build → alembic upgrade head → uvicorn
    └── nextcrop-web  →  npm ci && npm run build → static publish
```

**Database migrations** run via `start.sh` using `DATABASE_URL_UNPOOLED` (direct connection, bypasses PgBouncer which blocks DDL).

To trigger a manual deploy: Render dashboard → service → **Manual Deploy** → **Deploy latest commit**.

---

## Security

- Secrets never in the repo — loaded from environment at runtime
- Phone numbers stored as HMAC-SHA256 with a server-side pepper, never in plain text
- OTP: 6 digits, 5-minute expiry, 3 attempts max, 5 per number per hour, Uganda number allow-list
- USSD/SMS webhooks: IP allow-list + shared secret + replay protection
- Audit log is immutable (database trigger blocks UPDATE/DELETE)
- No PII in logs (structlog redaction processor)
- JWT access tokens: 60-minute expiry; refresh tokens: 30-day expiry with rotation

---

## Data sources and limits

| Source | Data | Resolution |
|--------|------|-----------|
| NASA POWER | Daily rainfall, temperature | ~0.5° (~55 km) |
| NASA SMAP | Soil moisture | ~9 km |
| NASA MODIS | NDVI (vegetation index) | 250 m – 500 m |
| GPM IMERG | Near-real-time precipitation | ~10 km |

**Honest limits:** All outputs carry a confidence label. The system never claims plot-level soil measurement. When data is missing or stale the API says so and still returns a safe rule-based answer. Supported area: **Lango sub-region, Uganda** (districts: Lira, Otuke, Alebtong, Kole, Amolatar, Dokolo, Oyam, Apac).

---

## Disclaimer

NextCrop provides regional climate-informed crop rotation guidance. It is not a substitute for advice from a qualified extension officer. Actual conditions on individual plots may differ from regional satellite data.

---

## Licence

Private — NextCrop project. All rights reserved.

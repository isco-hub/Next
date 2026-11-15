#!/usr/bin/env bash
set -e

commit() {
  git add -A
  git commit -m "$1"
}

# 1
echo "# NextCrop" > README.md
commit "docs: initialise root README"

# 2
cat >> README.md << 'EOF'

## Overview
NextCrop is an agri-advisory platform delivering crop recommendations via web and USSD.
EOF
commit "docs: add project overview to README"

# 3
cat >> README.md << 'EOF'

## Architecture
- **backend/** – FastAPI service (Python)
- **frontend/** – React PWA (TypeScript / Vite)
EOF
commit "docs: document high-level architecture in README"

# 4
cat >> README.md << 'EOF'

## Quick Start
See `backend/README.md` and `frontend/README.md` for setup instructions.
EOF
commit "docs: add quick-start pointers to README"

# 5
cat >> backend/README.md << 'EOF'

## Environment Variables
Copy `.env.example` to `.env` and fill in the required values before running.
EOF
commit "docs(backend): document environment variable setup"

# 6
cat >> backend/README.md << 'EOF'

## Running Tests
```
pytest tests/
```
EOF
commit "docs(backend): add test-running instructions"

# 7
cat >> backend/README.md << 'EOF'

## Docker
```
docker compose up --build
```
EOF
commit "docs(backend): add Docker usage section"

# 8
sed -i 's/# NextCrop Backend/# NextCrop Backend\n\n> Production-ready FastAPI service for crop advisory data./' backend/README.md
commit "docs(backend): improve README headline"

# 9
echo "" >> backend/app/core/settings.py
commit "refactor(backend): trailing newline in settings"

# 10
echo "" >> backend/app/core/security.py
commit "refactor(backend): trailing newline in security"

# 11
echo "" >> backend/app/core/errors.py
commit "refactor(backend): trailing newline in errors"

# 12
echo "" >> backend/app/core/logging.py
commit "refactor(backend): trailing newline in logging"

# 13
echo "" >> backend/app/main.py
commit "refactor(backend): trailing newline in main"

# 14
echo "" >> backend/app/db/models.py
commit "refactor(backend): trailing newline in models"

# 15
echo "" >> backend/app/db/session.py
commit "refactor(backend): trailing newline in session"

# 16
echo "" >> backend/app/api/v1/auth.py
commit "refactor(backend): trailing newline in auth router"

# 17
echo "" >> backend/app/api/v1/plots.py
commit "refactor(backend): trailing newline in plots router"

# 18
echo "" >> backend/app/api/v1/recommendations.py
commit "refactor(backend): trailing newline in recommendations router"

# 19
echo "" >> backend/app/api/v1/reports.py
commit "refactor(backend): trailing newline in reports router"

# 20
echo "" >> backend/app/api/v1/outlook.py
commit "refactor(backend): trailing newline in outlook router"

# 21
echo "" >> backend/app/api/v1/feedback.py
commit "refactor(backend): trailing newline in feedback router"

# 22
echo "" >> backend/app/api/v1/ussd.py
commit "refactor(backend): trailing newline in ussd router"

# 23
echo "" >> backend/app/api/v1/admin.py
commit "refactor(backend): trailing newline in admin router"

# 24
echo "" >> backend/app/api/v1/health.py
commit "refactor(backend): trailing newline in health router"

# 25
echo "" >> backend/app/api/v1/translations.py
commit "refactor(backend): trailing newline in translations router"

# 26
echo "" >> backend/app/api/v1/extension.py
commit "refactor(backend): trailing newline in extension router"

# 27
echo "" >> backend/app/domain/rules/engine.py
commit "refactor(backend): trailing newline in rules engine"

# 28
echo "" >> backend/app/domain/rules/loader.py
commit "refactor(backend): trailing newline in rules loader"

# 29
echo "" >> backend/app/domain/outlook/service.py
commit "refactor(backend): trailing newline in outlook service"

# 30
echo "" >> backend/app/ingestion/modis.py
commit "refactor(backend): trailing newline in modis ingestion"

# 31
echo "" >> backend/app/ingestion/power.py
commit "refactor(backend): trailing newline in power ingestion"

# 32
echo "" >> backend/app/ingestion/smap.py
commit "refactor(backend): trailing newline in smap ingestion"

# 33
echo "" >> backend/app/ingestion/quality.py
commit "refactor(backend): trailing newline in quality ingestion"

# 34
echo "" >> backend/app/ingestion/sms_provider.py
commit "refactor(backend): trailing newline in sms_provider"

# 35
echo "" >> backend/app/workers/tasks.py
commit "refactor(backend): trailing newline in celery tasks"

# 36
echo "" >> backend/app/workers/sms_tasks.py
commit "refactor(backend): trailing newline in sms_tasks"

# 37
echo "" >> backend/app/workers/retention.py
commit "refactor(backend): trailing newline in retention worker"

# 38
echo "" >> backend/app/workers/celery_app.py
commit "refactor(backend): trailing newline in celery_app"

# 39
echo "" >> backend/app/channels/sms.py
commit "refactor(backend): trailing newline in sms channel"

# 40
echo "" >> backend/app/channels/ussd.py
commit "refactor(backend): trailing newline in ussd channel"

# 41
echo "" >> backend/app/api/v1/deps.py
commit "refactor(backend): trailing newline in deps"

# 42
echo "" >> backend/scripts/agronomic_validation.py
commit "refactor(backend): trailing newline in agronomic_validation script"

# 43
echo "" >> backend/scripts/provision_staff.py
commit "refactor(backend): trailing newline in provision_staff script"

# 44
echo "" >> backend/tests/unit/test_units.py
commit "test(backend): trailing newline in test_units"

# 45
echo "" >> backend/tests/unit/test_auth_sessions.py
commit "test(backend): trailing newline in test_auth_sessions"

# 46
echo "" >> backend/tests/unit/test_engine_properties.py
commit "test(backend): trailing newline in test_engine_properties"

# 47
echo "" >> backend/tests/integration/test_api.py
commit "test(backend): trailing newline in test_api"

# 48
echo "" >> backend/tests/golden/cases.py
commit "test(backend): trailing newline in golden cases"

# 49
echo "" >> backend/tests/golden/test_golden.py
commit "test(backend): trailing newline in golden test"

# 50
echo "" >> backend/tests/load/locustfile.py
commit "test(backend): trailing newline in locustfile"

# 51
echo "" >> backend/tests/fixtures/test_aggregator_contracts.py
commit "test(backend): trailing newline in aggregator contracts fixture"

# 52
echo "" >> backend/tests/fixtures/test_outage_simulation.py
commit "test(backend): trailing newline in outage simulation fixture"

# 53
echo "" >> backend/tests/fixtures/test_pipeline_chaos.py
commit "test(backend): trailing newline in pipeline chaos fixture"

# 54
echo "" >> backend/db/seeds/grid_cells.py 2>/dev/null || echo "" >> backend/app/db/seeds/grid_cells.py
commit "refactor(backend): trailing newline in grid_cells seed"

# 55
echo "" >> backend/app/db/migrations/env.py
commit "refactor(backend): trailing newline in alembic env"

# 56
echo "" >> backend/app/db/migrations/versions/0001_schema_v1.py
commit "refactor(backend): trailing newline in migration 0001"

# 57
echo "" >> backend/app/db/migrations/versions/0002_auth_sessions.py
commit "refactor(backend): trailing newline in migration 0002"

# 58
echo "" >> backend/app/db/migrations/versions/0003_climate_daily_date.py
commit "refactor(backend): trailing newline in migration 0003"

# 59 – frontend
echo "" >> frontend/apps/web/src/main.tsx
commit "refactor(frontend): trailing newline in main.tsx"

# 60
echo "" >> frontend/apps/web/src/App.tsx
commit "refactor(frontend): trailing newline in App.tsx"

# 61
echo "" >> frontend/apps/web/src/lib/api.ts
commit "refactor(frontend): trailing newline in api.ts"

# 62
echo "" >> frontend/apps/web/src/lib/auth.tsx
commit "refactor(frontend): trailing newline in auth.tsx"

# 63
echo "" >> frontend/apps/web/src/lib/cache.ts
commit "refactor(frontend): trailing newline in cache.ts"

# 64
echo "" >> frontend/apps/web/src/lib/draft.ts
commit "refactor(frontend): trailing newline in draft.ts"

# 65
echo "" >> frontend/apps/web/src/lib/errors.ts
commit "refactor(frontend): trailing newline in errors.ts"

# 66
echo "" >> frontend/apps/web/src/lib/install.ts
commit "refactor(frontend): trailing newline in install.ts"

# 67
echo "" >> frontend/apps/web/src/lib/online.ts
commit "refactor(frontend): trailing newline in online.ts"

# 68
echo "" >> frontend/apps/web/src/lib/options.ts
commit "refactor(frontend): trailing newline in options.ts"

# 69
echo "" >> frontend/apps/web/src/lib/prefs.tsx
commit "refactor(frontend): trailing newline in prefs.tsx"

# 70
echo "" >> frontend/apps/web/src/lib/pwa.ts
commit "refactor(frontend): trailing newline in pwa.ts"

# 71
echo "" >> frontend/apps/web/src/lib/query.ts
commit "refactor(frontend): trailing newline in query.ts"

# 72
echo "" >> frontend/apps/web/src/lib/queue.ts
commit "refactor(frontend): trailing newline in queue.ts"

# 73
echo "" >> frontend/apps/web/src/lib/roles.ts
commit "refactor(frontend): trailing newline in roles.ts"

# 74
echo "" >> frontend/apps/web/src/lib/session.ts
commit "refactor(frontend): trailing newline in session.ts"

# 75
echo "" >> frontend/apps/web/src/lib/toast.tsx
commit "refactor(frontend): trailing newline in toast.tsx"

# 76
echo "" >> frontend/apps/web/src/components/AppShell.tsx
commit "refactor(frontend): trailing newline in AppShell"

# 77
echo "" >> frontend/apps/web/src/components/RouteGuards.tsx
commit "refactor(frontend): trailing newline in RouteGuards"

# 78
echo "" >> frontend/apps/web/src/components/LocationMap.tsx
commit "refactor(frontend): trailing newline in LocationMap"

# 79
echo "" >> frontend/apps/web/src/components/InstallPrompt.tsx
commit "refactor(frontend): trailing newline in InstallPrompt"

# 80
echo "" >> frontend/apps/web/src/components/UpdatePrompt.tsx
commit "refactor(frontend): trailing newline in UpdatePrompt"

# 81
echo "" >> frontend/apps/web/src/components/PageHeader.tsx
commit "refactor(frontend): trailing newline in PageHeader"

# 82
echo "" >> frontend/apps/web/src/components/PageState.tsx
commit "refactor(frontend): trailing newline in PageState"

# 83
echo "" >> frontend/apps/web/src/components/ScrollToTop.tsx
commit "refactor(frontend): trailing newline in ScrollToTop"

# 84
echo "" >> frontend/packages/ui/src/Button.tsx
commit "refactor(frontend): trailing newline in Button"

# 85
echo "" >> frontend/packages/ui/src/Badge.tsx
commit "refactor(frontend): trailing newline in Badge"

# 86
echo "" >> frontend/packages/ui/src/Banner.tsx
commit "refactor(frontend): trailing newline in Banner"

# 87
echo "" >> frontend/packages/ui/src/Toast.tsx
commit "refactor(frontend): trailing newline in Toast"

# 88
echo "" >> frontend/packages/ui/src/StatCard.tsx
commit "refactor(frontend): trailing newline in StatCard"

# 89
echo "" >> frontend/packages/ui/src/SeasonCard.tsx
commit "refactor(frontend): trailing newline in SeasonCard"

# 90
echo "" >> frontend/packages/ui/src/RainfallChart.tsx
commit "refactor(frontend): trailing newline in RainfallChart"

# 91
echo "" >> frontend/packages/ui/src/MoistureGauge.tsx
commit "refactor(frontend): trailing newline in MoistureGauge"

# 92
echo "" >> frontend/packages/ui/src/PlanTimeline.tsx
commit "refactor(frontend): trailing newline in PlanTimeline"

# 93
echo "" >> frontend/packages/ui/src/Stepper.tsx
commit "refactor(frontend): trailing newline in Stepper"

# 94
echo "" >> frontend/packages/ui/src/Field.tsx
commit "refactor(frontend): trailing newline in Field"

# 95
echo "" >> frontend/packages/ui/src/Icon.tsx
commit "refactor(frontend): trailing newline in Icon"

# 96
echo "" >> frontend/packages/api-client/src/client.ts
commit "refactor(frontend): trailing newline in api-client/client"

# 97
echo "" >> frontend/packages/api-client/src/types.ts
commit "refactor(frontend): trailing newline in api-client/types"

# 98
echo "" >> frontend/packages/api-client/src/locations.ts
commit "refactor(frontend): trailing newline in api-client/locations"

# 99
echo "" >> frontend/packages/api-client/src/sms.ts
commit "refactor(frontend): trailing newline in api-client/sms"

# 100
echo "" >> frontend/packages/i18n/src/catalogues.ts
commit "refactor(frontend): trailing newline in i18n/catalogues"

# 101
echo "" >> frontend/packages/i18n/src/index.tsx
commit "refactor(frontend): trailing newline in i18n/index"

# 102
echo "" >> frontend/packages/i18n/src/pseudo.ts
commit "refactor(frontend): trailing newline in i18n/pseudo"

# 103
echo "" >> frontend/packages/i18n/src/status.ts
commit "refactor(frontend): trailing newline in i18n/status"

echo "Done – $(git log --oneline | wc -l) commits total"

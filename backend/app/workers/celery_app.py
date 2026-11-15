from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.settings import get_settings

settings = get_settings()

celery_app = Celery(
    "nextcrop",
    broker=str(settings.redis_url),
    backend=str(settings.redis_url),
    include=["app.workers.tasks", "app.workers.sms_tasks", "app.workers.retention"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Africa/Kampala",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "nightly-ingestion": {
            "task": "app.workers.tasks.run_nightly_pipeline",
            "schedule": crontab(hour=1, minute=0),  # 01:00 EAT
        },
        "stale-data-check": {
            "task": "app.workers.tasks.check_data_freshness",
            "schedule": crontab(hour="*/6", minute=0),
        },
        "onset-alerts": {
            "task": "app.workers.sms_tasks.send_onset_alerts",
            "schedule": crontab(hour=7, minute=0),  # 07:00 EAT, after nightly pipeline
        },
        "dry-spell-alerts": {
            "task": "app.workers.sms_tasks.send_dry_spell_alerts",
            "schedule": crontab(hour=7, minute=30),
        },
        "planting-window-alerts": {
            "task": "app.workers.sms_tasks.send_planting_window_alerts",
            "schedule": crontab(hour=8, minute=0),
        },
        "sms-spend-check": {
            "task": "app.workers.sms_tasks.check_sms_spend",
            "schedule": crontab(hour="*/12", minute=0),
        },
        "monthly-retention": {
            "task": "app.workers.retention.run_retention_jobs",
            "schedule": crontab(hour=2, minute=0, day_of_month=1),  # 1st of month
        },
    },
)

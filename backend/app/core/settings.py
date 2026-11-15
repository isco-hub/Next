from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"
    version: str = "1.0.0"

    # Database
    database_url: PostgresDsn = Field(
        default="postgresql+psycopg://nextcrop:nextcrop@localhost:5432/nextcrop"
    )
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # Redis
    redis_url: RedisDsn = Field(default="redis://localhost:6379/0")
    redis_session_db: int = 1
    redis_cache_db: int = 2

    # Security
    secret_key: str = Field(min_length=32)
    msisdn_pepper: str = Field(min_length=32)
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    otp_expire_seconds: int = 300
    otp_max_attempts: int = 3

    # Rate limits
    rate_limit_otp_per_number_per_hour: int = 5
    rate_limit_otp_per_ip_per_hour: int = 20
    rate_limit_api_per_user_per_minute: int = 60
    rate_limit_api_per_ip_per_minute: int = 120

    # USSD
    ussd_session_ttl_seconds: int = 120
    ussd_allowed_ips: list[str] = []
    ussd_shared_secret: str = ""

    # SMS
    sms_sender_id: str = "NextCrop"
    sms_provider_url: str = ""
    sms_api_key: str = ""
    sms_daily_cap_per_user: int = 3
    sms_quiet_start_hour: int = 21  # EAT
    sms_quiet_end_hour: int = 6  # EAT
    sms_spend_alarm_usd: float = 50.0

    # NASA / Earthdata
    earthdata_username: str = ""
    earthdata_password: str = ""
    power_base_url: str = "https://power.larc.nasa.gov/api/temporal/daily/point"

    # Ingestion
    ingestion_stale_alert_hours: int = 48
    ingestion_max_retries: int = 3

    # Sentry
    sentry_dsn: str = ""

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    # Pilot grid
    pilot_district_ids: list[str] = ["lira", "dokolo", "amolatar", "otuke", "alebtong"]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    APP_ENV: str = Field(default="development", pattern="^(development|test|staging|production)$")
    AI_SERVICE_HOST: str = "127.0.0.1"
    AI_SERVICE_PORT: int = Field(default=8200, ge=1, le=65_535)
    AI_SERVICE_ID: str = "miraaj-api"
    AI_SERVICE_VERSION: str = "0.1.0"
    AI_SERVICE_ALLOWED_IDS: str = "miraaj-api"
    AI_SERVICE_INTERNAL_SECRET: SecretStr = Field(min_length=32)
    AI_SERVICE_URL: str = Field(min_length=1)
    AI_SERVICE_REQUEST_TIMEOUT_MS: int = Field(default=5_000, ge=100, le=120_000)
    AI_SERVICE_REPLAY_WINDOW_SECONDS: int = Field(default=120, ge=5, le=600)
    AI_SERVICE_REDIS_REQUIRED: bool = False
    AI_SERVICE_DEPENDENCY_TIMEOUT_MS: int = Field(default=1_000, ge=100, le=5_000)
    LOG_LEVEL: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    REDIS_URL: str | None = None
    BUILD_ID: str | None = None

    @field_validator("LOG_LEVEL", mode="before")
    @classmethod
    def normalize_log_level(cls, value: object) -> str:
        return str(value).upper()

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def empty_redis_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @property
    def allowed_service_ids(self) -> frozenset[str]:
        return frozenset(
            service_id.strip()
            for service_id in self.AI_SERVICE_ALLOWED_IDS.split(",")
            if service_id.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reset_settings_cache() -> None:
    get_settings.cache_clear()

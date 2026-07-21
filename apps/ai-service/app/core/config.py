from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_OCR_PACKS = (
    "ara",
    "eng",
    "fra",
    "spa",
    "deu",
    "por",
    "ita",
    "nld",
    "tur",
    "rus",
)


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

    MEDIA_MAX_IMAGE_BYTES: int = Field(default=15_728_640, ge=1)
    MEDIA_MAX_PDF_BYTES: int = Field(default=26_214_400, ge=1)
    MEDIA_MAX_IMAGE_WIDTH: int = Field(default=12_000, ge=1)
    MEDIA_MAX_IMAGE_HEIGHT: int = Field(default=12_000, ge=1)
    MEDIA_MAX_IMAGE_PIXELS: int = Field(default=50_000_000, ge=1)
    MEDIA_MAX_PDF_PAGES: int = Field(default=25, ge=1)
    MEDIA_MAX_TOTAL_RENDERED_PIXELS: int = Field(default=150_000_000, ge=1)
    MEDIA_OCR_TIMEOUT_SECONDS: int = Field(default=90, ge=1, le=600)
    MEDIA_VISION_TIMEOUT_SECONDS: int = Field(default=90, ge=1, le=600)
    MEDIA_NORMALIZED_IMAGE_FORMAT: str = Field(default="webp", pattern="^(webp|png|jpeg)$")
    MEDIA_NORMALIZED_IMAGE_QUALITY: int = Field(default=90, ge=1, le=100)
    OCR_LANGUAGES_DEFAULT: str = "ara+eng+fra"
    OCR_LANGUAGES_INSTALLED: str = ",".join(DEFAULT_OCR_PACKS)
    OCR_MAX_LANGUAGES_PER_JOB: int = Field(default=4, ge=1, le=10)
    OCR_PRELIMINARY_LANGUAGES: str = "eng"
    OCR_MIN_CONFIDENCE: float = Field(default=0.55, ge=0.0, le=1.0)
    OCR_RETRY_MIN_CONFIDENCE: float = Field(default=0.35, ge=0.0, le=1.0)
    VISION_PROVIDER_ENABLED: bool = False
    GEMINI_API_KEY: SecretStr | None = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GEMINI_TIMEOUT_SECONDS: int = Field(default=90, ge=1, le=600)
    GEMINI_MAX_RETRIES: int = Field(default=1, ge=0, le=5)
    GEMINI_MAX_OUTPUT_TOKENS: int = Field(default=8192, ge=256, le=65_536)
    GEMINI_TEMPERATURE: float = Field(default=0.1, ge=0.0, le=2.0)
    MEDIA_FETCH_ALLOWED_HOSTS: str = "localhost,minio,127.0.0.1"
    MEDIA_FETCH_TIMEOUT_SECONDS: int = Field(default=30, ge=1, le=300)
    MEDIA_FETCH_MAX_BYTES: int = Field(default=26_214_400, ge=1)

    AI_REASONING_PROVIDER: str = Field(default="disabled", pattern="^(disabled|gemini)$")
    AI_REASONING_MODEL: str = "gemini-2.0-flash"
    AI_REASONING_TIMEOUT_SECONDS: int = Field(default=60, ge=1, le=600)
    AI_REASONING_MAX_RETRIES: int = Field(default=1, ge=0, le=5)
    AI_REASONING_MAX_INPUT_CHARS: int = Field(default=20_000, ge=100, le=200_000)

    # Prompt 4 — campaign generation + transcreation. Mirrors Nest defaults in
    # packages/shared-config (AI_CAMPAIGN_*, AI_TRANSLATION_*).
    AI_CAMPAIGN_PROVIDER: str = Field(default="disabled", pattern="^(disabled|gemini)$")
    AI_CAMPAIGN_MODEL: str = "gemini-2.0-flash"
    AI_CAMPAIGN_PROVIDER_TIMEOUT_SECONDS: int = Field(default=90, ge=1, le=600)
    AI_CAMPAIGN_PROVIDER_MAX_RETRIES: int = Field(default=1, ge=0, le=5)
    AI_CAMPAIGN_MAX_INPUT_CHARS: int = Field(default=50_000, ge=1_000, le=200_000)
    AI_CAMPAIGN_MAX_OUTPUT_CHARS: int = Field(default=100_000, ge=1_000, le=500_000)
    AI_TRANSLATION_PROVIDER: str = Field(default="disabled", pattern="^(disabled|gemini)$")
    AI_TRANSLATION_MODEL: str = "gemini-2.0-flash"
    AI_TRANSLATION_TIMEOUT_SECONDS: int = Field(default=60, ge=1, le=600)
    AI_TRANSLATION_MAX_RETRIES: int = Field(default=1, ge=0, le=5)

    # Prompt 5 — creative image/video generation + local render. Defaults keep
    # providers offline (disabled/mock only; no live commercial media APIs).
    AI_IMAGE_PROVIDER: str = Field(default="disabled", pattern="^(disabled|mock)$")
    AI_IMAGE_MODEL: str = ""
    AI_IMAGE_PROVIDER_TIMEOUT_SECONDS: int = Field(default=300, ge=5, le=1_800)
    AI_IMAGE_PROVIDER_MAX_RETRIES: int = Field(default=2, ge=0, le=5)
    AI_VIDEO_PROVIDER: str = Field(default="disabled", pattern="^(disabled|mock)$")
    AI_VIDEO_MODEL: str = ""
    AI_VIDEO_PROVIDER_TIMEOUT_SECONDS: int = Field(default=900, ge=5, le=3_600)
    AI_VIDEO_PROVIDER_MAX_RETRIES: int = Field(default=2, ge=0, le=5)
    AI_RENDER_PROVIDER: str = Field(default="local", pattern="^(local|disabled)$")
    AI_RENDER_TIMEOUT_SECONDS: int = Field(default=600, ge=5, le=3_600)
    CREATIVE_MAX_IMAGE_BYTES: int = Field(default=52_428_800, ge=1_024)
    CREATIVE_MAX_VIDEO_BYTES: int = Field(default=1_073_741_824, ge=1_024)
    CREATIVE_MAX_VIDEO_DURATION_SECONDS: int = Field(default=600, ge=1, le=3_600)
    CREATIVE_MAX_PROVIDER_DOWNLOAD_BYTES: int = Field(default=1_073_741_824, ge=1_024)
    CREATIVE_PROVIDER_DOWNLOAD_TIMEOUT_SECONDS: int = Field(default=300, ge=5, le=1_800)

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

    @field_validator("GEMINI_API_KEY", mode="before")
    @classmethod
    def empty_gemini_key_to_none(cls, value: object) -> object:
        if value == "" or value is None:
            return None
        return value

    @property
    def allowed_service_ids(self) -> frozenset[str]:
        return frozenset(
            service_id.strip()
            for service_id in self.AI_SERVICE_ALLOWED_IDS.split(",")
            if service_id.strip()
        )

    @property
    def media_fetch_allowed_hosts(self) -> frozenset[str]:
        return frozenset(
            entry.strip().lower()
            for entry in self.MEDIA_FETCH_ALLOWED_HOSTS.split(",")
            if entry.strip()
        )

    @property
    def ocr_languages_default_packs(self) -> tuple[str, ...]:
        return tuple(pack.strip() for pack in self.OCR_LANGUAGES_DEFAULT.split("+") if pack.strip())

    @property
    def ocr_languages_installed_packs(self) -> frozenset[str]:
        return frozenset(
            pack.strip() for pack in self.OCR_LANGUAGES_INSTALLED.split(",") if pack.strip()
        )

    @property
    def ocr_preliminary_language_packs(self) -> tuple[str, ...]:
        return tuple(
            pack.strip() for pack in self.OCR_PRELIMINARY_LANGUAGES.split(",") if pack.strip()
        )

    @property
    def vision_provider_active(self) -> bool:
        return self.VISION_PROVIDER_ENABLED and self.GEMINI_API_KEY is not None

    @property
    def ai_reasoning_provider_active(self) -> bool:
        return self.AI_REASONING_PROVIDER == "gemini" and self.GEMINI_API_KEY is not None

    @property
    def ai_campaign_provider_active(self) -> bool:
        return self.AI_CAMPAIGN_PROVIDER == "gemini" and self.GEMINI_API_KEY is not None

    @property
    def ai_translation_provider_active(self) -> bool:
        return self.AI_TRANSLATION_PROVIDER == "gemini" and self.GEMINI_API_KEY is not None

    @property
    def ai_image_provider_active(self) -> bool:
        return self.AI_IMAGE_PROVIDER == "mock"

    @property
    def ai_video_provider_active(self) -> bool:
        return self.AI_VIDEO_PROVIDER == "mock"

    @property
    def ai_render_provider_active(self) -> bool:
        return self.AI_RENDER_PROVIDER == "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reset_settings_cache() -> None:
    get_settings.cache_clear()

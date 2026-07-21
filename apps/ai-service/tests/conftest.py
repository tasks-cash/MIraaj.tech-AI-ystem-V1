import os

TEST_ENVIRONMENT = {
    "APP_ENV": "test",
    "AI_SERVICE_HOST": "127.0.0.1",
    "AI_SERVICE_PORT": "8200",
    "AI_SERVICE_ID": "miraaj-api",
    "AI_SERVICE_VERSION": "0.1.0",
    "AI_SERVICE_ALLOWED_IDS": "miraaj-api",
    "AI_SERVICE_INTERNAL_SECRET": "test-only-internal-secret-with-32-characters",
    "AI_SERVICE_URL": "http://localhost:8200",
    "AI_SERVICE_REQUEST_TIMEOUT_MS": "5000",
    "AI_SERVICE_REPLAY_WINDOW_SECONDS": "120",
    "AI_SERVICE_REDIS_REQUIRED": "false",
    "AI_SERVICE_DEPENDENCY_TIMEOUT_MS": "100",
    "LOG_LEVEL": "INFO",
    "REDIS_URL": "",
    "BUILD_ID": "test-build",
    "MEDIA_FETCH_ALLOWED_HOSTS": "127.0.0.1,localhost,localhost:9200",
    "VISION_PROVIDER_ENABLED": "false",
    "GEMINI_API_KEY": "",
    "AI_CAMPAIGN_PROVIDER": "disabled",
    "AI_CAMPAIGN_MODEL": "gemini-2.0-flash",
    "AI_CAMPAIGN_PROVIDER_TIMEOUT_SECONDS": "90",
    "AI_CAMPAIGN_PROVIDER_MAX_RETRIES": "1",
    "AI_CAMPAIGN_MAX_INPUT_CHARS": "50000",
    "AI_CAMPAIGN_MAX_OUTPUT_CHARS": "100000",
    "AI_TRANSLATION_PROVIDER": "disabled",
    "AI_TRANSLATION_MODEL": "gemini-2.0-flash",
    "AI_TRANSLATION_TIMEOUT_SECONDS": "60",
    "AI_TRANSLATION_MAX_RETRIES": "1",
    "AI_IMAGE_PROVIDER": "disabled",
    "AI_IMAGE_MODEL": "",
    "AI_IMAGE_PROVIDER_API_KEY": "",
    "AI_IMAGE_PROVIDER_BASE_URL": "https://api.openai.com",
    "AI_IMAGE_PROVIDER_TIMEOUT_SECONDS": "300",
    "AI_IMAGE_PROVIDER_MAX_RETRIES": "2",
    "AI_IMAGE_PROVIDER_MAX_VARIANTS": "4",
    "AI_VIDEO_PROVIDER": "disabled",
    "AI_VIDEO_MODEL": "",
    "AI_VIDEO_PROVIDER_API_KEY": "",
    "AI_VIDEO_PROVIDER_BASE_URL": "https://api.dev.runwayml.com",
    "AI_VIDEO_PROVIDER_TIMEOUT_SECONDS": "1200",
    "AI_VIDEO_PROVIDER_MAX_RETRIES": "2",
    "AI_VIDEO_PROVIDER_POLL_INTERVAL_SECONDS": "10",
    "AI_VIDEO_PROVIDER_MAX_POLL_ATTEMPTS": "120",
    "AI_RENDER_PROVIDER": "local",
    "AI_RENDER_TIMEOUT_SECONDS": "600",
    "AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED": "false",
    "AI_PROVIDER_USAGE_TRACKING_ENABLED": "true",
    "AI_PROVIDER_MAX_ACTIVE_IMAGE_JOBS": "2",
    "AI_PROVIDER_MAX_ACTIVE_VIDEO_JOBS": "1",
    "AI_PROVIDER_DAILY_COST_LIMIT": "",
    "AI_PROVIDER_JOB_COST_LIMIT": "",
    "AI_PROVIDER_MONTHLY_COST_LIMIT": "",
    "CREATIVE_MAX_IMAGE_BYTES": "52428800",
    "CREATIVE_MAX_VIDEO_BYTES": "1073741824",
    "CREATIVE_MAX_VIDEO_DURATION_SECONDS": "600",
    "CREATIVE_MAX_PROVIDER_DOWNLOAD_BYTES": "1073741824",
    "CREATIVE_PROVIDER_DOWNLOAD_TIMEOUT_SECONDS": "300",
}

for key, value in TEST_ENVIRONMENT.items():
    os.environ[key] = value


def openai_settings(**overrides: object):
    """Build Settings with OpenAI image provider enabled for unit tests."""

    from pydantic import SecretStr

    from app.core.config import Settings

    base = {
        "AI_SERVICE_INTERNAL_SECRET": "test-only-internal-secret-with-32-characters",
        "AI_SERVICE_URL": "http://localhost:8200",
        "APP_ENV": "test",
        "AI_IMAGE_PROVIDER": "openai",
        "AI_IMAGE_PROVIDER_API_KEY": SecretStr("sk-test-openai-key-not-real"),
        "AI_IMAGE_MODEL": "gpt-image-1",
        "AI_IMAGE_PROVIDER_BASE_URL": "https://api.openai.com",
    }
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def runway_settings(**overrides: object):
    """Build Settings with Runway video provider enabled for unit tests."""

    from pydantic import SecretStr

    from app.core.config import Settings

    base = {
        "AI_SERVICE_INTERNAL_SECRET": "test-only-internal-secret-with-32-characters",
        "AI_SERVICE_URL": "http://localhost:8200",
        "APP_ENV": "test",
        "AI_VIDEO_PROVIDER": "runway",
        "AI_VIDEO_PROVIDER_API_KEY": SecretStr("rw-test-runway-key-not-real"),
        "AI_VIDEO_MODEL": "gen3a_turbo",
        "AI_VIDEO_PROVIDER_BASE_URL": "https://api.dev.runwayml.com",
    }
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]

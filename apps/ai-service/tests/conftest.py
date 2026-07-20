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
}

for key, value in TEST_ENVIRONMENT.items():
    os.environ[key] = value

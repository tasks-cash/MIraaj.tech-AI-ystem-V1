from __future__ import annotations

import base64
import json
from time import perf_counter

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.models.media_schemas import VisionAnalysisOutput


class GeminiVisionProvider:
    provider_name = "gemini"

    def __init__(
        self,
        settings: Settings,
        *,
        client: httpx.AsyncClient | None = None,
        allow_live_requests: bool = False,
    ) -> None:
        self._settings = settings
        self._client = client
        self._allow_live_requests = allow_live_requests

    def is_enabled(self) -> bool:
        return self._settings.vision_provider_active

    async def analyze(
        self,
        *,
        image_bytes: bytes,
        mime_type: str,
        purpose: str | None,
        locale: str | None,
        country: str | None,
        ocr_text: str | None,
    ) -> VisionAnalysisOutput:
        if not self.is_enabled():
            raise RuntimeError("Vision provider is disabled.")
        if not self._allow_live_requests:
            raise RuntimeError("Live Gemini requests are disabled.")

        api_key = self._settings.GEMINI_API_KEY
        if api_key is None:
            raise RuntimeError("Gemini API key is not configured.")

        prompt = {
            "purpose": purpose or "general_media_context",
            "locale": locale,
            "country": country,
            "ocrText": ocr_text or "",
            "instructions": (
                "Return strict JSON matching VisionAnalysisOutput fields. "
                "Preserve brand names Miraaj.tech and Tasks.cash exactly."
            ),
        }
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": json.dumps(prompt)},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64.b64encode(image_bytes).decode("ascii"),
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": self._settings.GEMINI_TEMPERATURE,
                "maxOutputTokens": self._settings.GEMINI_MAX_OUTPUT_TOKENS,
                "responseMimeType": "application/json",
            },
        }
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self._settings.GEMINI_MODEL}:generateContent"
        )
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._settings.GEMINI_TIMEOUT_SECONDS)
        started = perf_counter()
        try:
            response = await client.post(
                url,
                params={"key": api_key.get_secret_value()},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
            text = body["candidates"][0]["content"]["parts"][0]["text"]
            processing_ms = max(0, round((perf_counter() - started) * 1_000))
            return self._parse_output(text, processing_ms=processing_ms)
        finally:
            if owns_client:
                await client.aclose()

    def _parse_output(self, text: str, *, processing_ms: int) -> VisionAnalysisOutput:
        last_error: Exception | None = None
        candidates = [text, self._repair_json(text)]
        seen: set[str] = set()
        for candidate in candidates:
            if candidate in seen:
                continue
            seen.add(candidate)
            try:
                parsed = json.loads(candidate)
                return VisionAnalysisOutput.model_validate(
                    {
                        **parsed,
                        "provider": self.provider_name,
                        "model": self._settings.GEMINI_MODEL,
                    }
                )
            except (json.JSONDecodeError, ValidationError, ValueError) as error:
                last_error = error
        raise ValueError("Vision provider returned invalid JSON.") from last_error

    @staticmethod
    def _repair_json(text: str) -> str:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("Vision provider returned invalid JSON.")
        return text[start : end + 1]

    async def analyze_with_mock_response(self, payload: dict[str, object]) -> VisionAnalysisOutput:
        return VisionAnalysisOutput.model_validate(
            {
                **payload,
                "provider": self.provider_name,
                "model": self._settings.GEMINI_MODEL,
            }
        )

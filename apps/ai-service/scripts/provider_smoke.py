#!/usr/bin/env python3
"""Controlled live smoke CLI for Prompt 5.1 production providers.

Refuses to call real OpenAI/Runway APIs unless ALL of:
  - AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED=true
  - provider selected + API key present
  - --confirm-live-provider-cost

Automated CI must never set these flags. Default action is health-only
(no spend). Live image/video commands report NOT RUN when credentials
are missing rather than fabricating success.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# Allow `python scripts/provider_smoke.py` from apps/ai-service.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _refuse(message: str, *, code: int = 2) -> int:
    print(json.dumps({"ok": False, "refused": True, "message": message}))
    return code


def _load_settings():
    from app.core.config import reset_settings_cache

    reset_settings_cache()
    from app.core.config import get_settings

    return get_settings()


async def _cmd_health() -> int:
    settings = _load_settings()
    from app.services.creative.factory import resolve_image_provider, resolve_video_provider

    image = resolve_image_provider(settings)
    video = resolve_video_provider(settings)
    image_health = await image.health_check()
    video_health = await video.health_check()
    print(
        json.dumps(
            {
                "ok": True,
                "liveSmokeTestEnabled": settings.AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED,
                "image": image_health,
                "video": video_health,
            },
            default=str,
        )
    )
    return 0


def _require_live_flags(*, kind: str) -> tuple[object, int] | int:
    settings = _load_settings()
    if not settings.AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED:
        return _refuse(
            "AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED must be true for live smoke tests."
        )
    if kind == "image":
        if settings.AI_IMAGE_PROVIDER != "openai":
            return _refuse("AI_IMAGE_PROVIDER must be openai for image smoke.")
        if settings.AI_IMAGE_PROVIDER_API_KEY is None:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "status": "NOT RUN — credentials not configured",
                        "provider": "openai",
                    }
                )
            )
            return 3
    else:
        if settings.AI_VIDEO_PROVIDER != "runway":
            return _refuse("AI_VIDEO_PROVIDER must be runway for video smoke.")
        if settings.AI_VIDEO_PROVIDER_API_KEY is None:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "status": "NOT RUN — credentials not configured",
                        "provider": "runway",
                    }
                )
            )
            return 3
    return settings, 0


async def _cmd_smoke_image(args: argparse.Namespace) -> int:
    if not args.confirm_live_provider_cost:
        return _refuse("Pass --confirm-live-provider-cost to spend provider credits.")
    loaded = _require_live_flags(kind="image")
    if isinstance(loaded, int):
        return loaded
    settings, _ = loaded

    from app.models.creative_schemas import GenerateImageInput
    from app.services.creative.openai_image_provider import OpenAIImageGenerationProvider

    provider = OpenAIImageGenerationProvider(settings, allow_live_requests=True)
    payload = GenerateImageInput(
        prompt=args.prompt
        or "Miraaj.tech controlled smoke test image — abstract geometric brand mark",
        width=1024,
        height=1024,
        jobId=args.job_id,
        briefId=args.creative_brief_id,
        conceptTitle="live-smoke",
        complianceNotes="Smoke test only; requires human review; no auto-approve.",
    )
    print(
        json.dumps(
            {
                "event": "ai.provider.live_smoke.started",
                "provider": "openai",
                "campaignPackageId": args.campaign_package_id,
                "creativeBriefId": args.creative_brief_id,
            }
        )
    )
    try:
        result = await provider.generate_image(payload)
    except Exception as error:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "event": "ai.provider.live_smoke.failed",
                    "provider": "openai",
                    "safeError": type(error).__name__,
                }
            )
        )
        return 1

    print(
        json.dumps(
            {
                "event": "ai.provider.live_smoke.completed",
                "provider": result.provider,
                "status": result.status,
                "jobId": result.jobId,
                "safeErrorCode": result.safeErrorCode,
                "byteLength": result.media.byteLength if result.media else 0,
                "sha256": result.media.sha256 if result.media else None,
                "hasOutputUrl": bool(result.outputUrl),
                # Never print outputUrl or base64.
            }
        )
    )
    return 0 if result.status in {"completed", "provider_pending"} else 1


async def _cmd_smoke_video(args: argparse.Namespace) -> int:
    if not args.confirm_live_provider_cost:
        return _refuse("Pass --confirm-live-provider-cost to spend provider credits.")
    loaded = _require_live_flags(kind="video")
    if isinstance(loaded, int):
        return loaded
    settings, _ = loaded

    from app.models.creative_schemas import GenerateVideoInput
    from app.services.creative.runway_video_provider import RunwayVideoGenerationProvider

    provider = RunwayVideoGenerationProvider(settings, allow_live_requests=True)
    payload = GenerateVideoInput(
        prompt=args.prompt
        or "Miraaj.tech controlled smoke test — slow camera pan over abstract shapes",
        width=1280,
        height=720,
        durationSeconds=2.0,
        jobId=args.job_id,
        briefId=args.creative_brief_id,
    )
    print(
        json.dumps(
            {
                "event": "ai.provider.live_smoke.started",
                "provider": "runway",
                "campaignPackageId": args.campaign_package_id,
                "creativeBriefId": args.creative_brief_id,
            }
        )
    )
    try:
        result = await provider.generate_video(payload)
    except Exception as error:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "event": "ai.provider.live_smoke.failed",
                    "provider": "runway",
                    "safeError": type(error).__name__,
                }
            )
        )
        return 1

    print(
        json.dumps(
            {
                "event": "ai.provider.live_smoke.completed",
                "provider": result.provider,
                "status": result.status,
                "jobId": result.jobId,
                "providerJobId": result.providerJobId,
                "safeErrorCode": result.safeErrorCode,
                "hasOutputUrl": bool(result.outputUrl),
            }
        )
    )
    return 0 if result.status in {"completed", "provider_pending"} else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prompt 5.1 provider smoke CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("health", help="Safe provider health (no spend)")

    image = sub.add_parser("smoke-image", help="Live OpenAI image smoke (costs money)")
    image.add_argument("--campaign-package-id", required=True)
    image.add_argument("--creative-brief-id", required=True)
    image.add_argument("--job-id", default=None)
    image.add_argument("--prompt", default=None)
    image.add_argument(
        "--confirm-live-provider-cost",
        action="store_true",
        help="Required acknowledgement that this call spends provider credits.",
    )

    video = sub.add_parser("smoke-video", help="Live Runway video smoke (costs money)")
    video.add_argument("--campaign-package-id", required=True)
    video.add_argument("--creative-brief-id", required=True)
    video.add_argument("--job-id", default=None)
    video.add_argument("--prompt", default=None)
    video.add_argument(
        "--confirm-live-provider-cost",
        action="store_true",
        help="Required acknowledgement that this call spends provider credits.",
    )

    args = parser.parse_args(argv)
    # Hard refuse if CI accidentally enables live smoke without confirmation path.
    if os.environ.get("CI", "").lower() in {"1", "true", "yes"} and args.command != "health":
        return _refuse("Live provider smoke is refused under CI.")

    if args.command == "health":
        return asyncio.run(_cmd_health())
    if args.command == "smoke-image":
        return asyncio.run(_cmd_smoke_image(args))
    if args.command == "smoke-video":
        return asyncio.run(_cmd_smoke_video(args))
    return _refuse(f"Unknown command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())

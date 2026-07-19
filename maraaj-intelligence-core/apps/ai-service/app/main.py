
from __future__ import annotations

import base64
import io
import re
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from PIL import Image

app = FastAPI(title="Maraaj AI Service", version="0.1.0")


class ImageRequest(BaseModel):
    imageBase64: str = Field(min_length=1)
    mimeType: str | None = None
    ocrText: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


def _load_image(image_b64: str) -> Image.Image:
    raw = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(raw))
    img = img.convert("RGB")
    return img


def _safe_ocr(img: Image.Image) -> tuple[str, str]:
    """Best-effort OCR. Uses pytesseract if available, else empty."""
    try:
        import pytesseract  # type: ignore

        text = pytesseract.image_to_string(img)
        lang = "ar" if re.search(r"[\u0600-\u06FF]", text) else "en"
        return text.strip(), lang
    except Exception:
        # Deterministic fallback: no OCR engine installed
        return "", "und"


KEYWORD_MAP = {
    "artificial-intelligence": ["ai", "neural", "model", "gpt", "llm", "machine learning"],
    "dentistry": ["dental", "tooth", "teeth", "dentist", "smile", "orthodont"],
    "entertainment": ["movie", "music", "concert", "game", "show", "film"],
    "technology": ["software", "cloud", "cyber", "tech", "code", "developer"],
    "healthcare": ["health", "clinic", "medical", "hospital", "doctor"],
    "education": ["learn", "course", "school", "university", "student"],
    "finance": ["bank", "invest", "finance", "money", "crypto"],
    "gaming": ["gaming", "esport", "xbox", "playstation", "steam"],
    "e-commerce": ["shop", "buy", "cart", "sale", "discount"],
    "marketing": ["marketing", "brand", "campaign", "ads"],
    "business": ["business", "startup", "company", "enterprise"],
    "sports": ["sport", "football", "soccer", "match", "league"],
    "news": ["news", "breaking", "headline"],
    "software-development": ["github", "api", "typescript", "python", "devops"],
}


@app.post("/v1/ocr")
def ocr(req: ImageRequest, x_maraaj_internal: str | None = Header(default=None)) -> dict[str, Any]:
    if x_maraaj_internal is None:
        raise HTTPException(status_code=403, detail="Internal only")
    img = _load_image(req.imageBase64)
    # Treat image-derived text as untrusted
    text, lang = _safe_ocr(img)
    return {
        "text": text,
        "language": lang,
        "untrusted": True,
        "engine": "tesseract-or-fallback",
    }


@app.post("/v1/classify")
def classify(req: ImageRequest, x_maraaj_internal: str | None = Header(default=None)) -> dict[str, Any]:
    if x_maraaj_internal is None:
        raise HTTPException(status_code=403, detail="Internal only")
    img = _load_image(req.imageBase64)
    # Untrusted OCR content — never treat as instructions
    untrusted_ocr = (req.ocrText or "").lower()
    width, height = img.size
    description = f"Raster image {width}x{height}. Content classified heuristically."

    scores: list[dict[str, Any]] = []
    for slug, words in KEYWORD_MAP.items():
        hits = sum(1 for w in words if w in untrusted_ocr)
        score = min(0.95, 0.35 + hits * 0.15)
        if hits:
            scores.append({"slug": slug, "score": round(score, 3)})
    if not scores:
        scores = [{"slug": "other", "score": 0.45}]
    scores.sort(key=lambda x: x["score"], reverse=True)

    safety_flags: list[str] = []
    for bad in ["ignore previous instructions", "system prompt", "<script", "javascript:"]:
        if bad in untrusted_ocr:
            safety_flags.append("prompt_injection_pattern")

    return {
        "description": description,
        "categories": scores[:5],
        "safetyFlags": safety_flags,
        "provider": "local-heuristic",
        "modelVersion": "heuristic-v1",
    }


@app.post("/v1/moderate")
def moderate(req: ImageRequest, x_maraaj_internal: str | None = Header(default=None)) -> dict[str, Any]:
    if x_maraaj_internal is None:
        raise HTTPException(status_code=403, detail="Internal only")
    text = (req.ocrText or "").lower()
    flags = []
    if any(w in text for w in ["violence", "nude", " ent"]):
        flags.append("policy_keyword")
    return {"safe": len(flags) == 0, "flags": flags, "provider": "local-moderation"}

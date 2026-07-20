from __future__ import annotations

import io

from PIL import Image, ImageEnhance, ImageOps

from app.core.config import Settings


def preprocess_for_ocr(image: Image.Image, settings: Settings) -> bytes:
    working = ImageOps.exif_transpose(image)
    working = working.convert("L")
    max_edge = max(working.size)
    if max_edge > 3_000:
        scale = 3_000 / max_edge
        working = working.resize(
            (max(1, int(working.width * scale)), max(1, int(working.height * scale)))
        )

    try:
        import cv2
        import numpy as np

        array = np.array(working)
        denoised = cv2.fastNlMeansDenoising(array, h=10)
        _, threshold = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        working = Image.fromarray(threshold)
    except Exception:
        working = ImageEnhance.Contrast(working).enhance(1.5)

    buffer = io.BytesIO()
    working.save(buffer, format="PNG")
    if len(buffer.getvalue()) > settings.MEDIA_MAX_IMAGE_BYTES:
        raise ValueError("Preprocessed OCR image exceeds byte limit.")
    return buffer.getvalue()

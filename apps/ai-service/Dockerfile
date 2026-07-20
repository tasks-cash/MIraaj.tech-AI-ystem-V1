FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ara \
    tesseract-ocr-eng \
    tesseract-ocr-fra \
    tesseract-ocr-spa \
    tesseract-ocr-deu \
    tesseract-ocr-por \
    tesseract-ocr-ita \
    tesseract-ocr-nld \
    tesseract-ocr-tur \
    tesseract-ocr-rus \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/ai-service/requirements.lock.txt ./requirements.lock.txt
RUN pip install --no-cache-dir --requirement requirements.lock.txt

COPY apps/ai-service/app ./app

RUN addgroup --system --gid 1001 ai \
  && adduser --system --uid 1001 --ingroup ai ai
USER ai

EXPOSE 8200
HEALTHCHECK --interval=10s --timeout=5s --retries=10 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8200/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8200"]

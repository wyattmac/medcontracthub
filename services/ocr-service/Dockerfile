# Multi-stage build for OCR microservice
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download ML models during build
RUN python -c "import transformers; transformers.pipeline('document-question-answering', model='impira/layoutlm-document-qa')"

FROM base AS development
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=development
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100", "--reload"]

FROM base AS production
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
COPY . .
# Pre-compile Python files
RUN python -m compileall .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "4"]
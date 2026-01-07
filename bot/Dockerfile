# Dockerfile for EatFit24 Telegram Bot (UV-based)

# ============================================================
# Builder Stage - Install uv and dependencies
# ============================================================
FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:/root/.cargo/bin:$PATH"

# Copy dependency files FIRST (for Docker layer caching)
COPY pyproject.toml uv.lock ./

# Install Python dependencies (production only)
RUN uv sync --no-dev

# ============================================================
# Runtime Stage - Final image
# ============================================================
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/app/.venv/bin:$PATH

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -s /bin/bash appuser

# Copy installed Python packages from builder
COPY --from=builder /app/.venv /app/.venv

# Copy project files with proper ownership
COPY --chown=appuser:appuser . .

# Create logs directory
RUN mkdir -p logs && chown -R appuser:appuser logs

# Fix line endings and make entrypoint executable
RUN dos2unix /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Switch to non-root user
USER appuser

# Use ENTRYPOINT for startup
ENTRYPOINT ["/app/entrypoint.sh"]

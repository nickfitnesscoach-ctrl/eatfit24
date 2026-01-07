# Dockerfile for EatFit24 Django Backend (UV-based)
# Multi-stage build for smaller production images

# ============================================================
# Stage 1: Builder - Install uv and dependencies
# ============================================================
FROM python:3.12-slim AS builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install system dependencies required for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:/root/.cargo/bin:$PATH"

# Copy dependency files FIRST (for Docker layer caching)
COPY pyproject.toml uv.lock ./

# Install Python dependencies (production only, no dev deps)
RUN uv sync --no-dev

# ============================================================
# Stage 2: Runtime - Final lightweight image
# ============================================================
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/app/.venv/bin:$PATH

WORKDIR /app

# Install only runtime dependencies (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -s /bin/bash appuser

# Copy installed Python packages from builder
COPY --from=builder /app/.venv /app/.venv

# Copy project files
COPY --chown=appuser:appuser . .

# Create necessary directories with proper ownership
RUN mkdir -p logs staticfiles media celerybeat-data && \
    chown -R appuser:appuser logs staticfiles media celerybeat-data

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check (will be overridden by compose healthcheck)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f -H "Host: eatfit24.ru" http://localhost:8000/health/ || exit 1

# Use entrypoint script (handles migrations, collectstatic, then starts gunicorn)
ENTRYPOINT ["./entrypoint.sh"]

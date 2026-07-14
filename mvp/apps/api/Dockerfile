# Multi-stage com uv: lockfile congelado = build reprodutível; a mesma imagem
# serve api e worker (muda só o command no compose), espelhando o par ECS futuro.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS deps
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim-bookworm
WORKDIR /app
COPY --from=deps /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH" PYTHONPATH=/app/src
COPY alembic.ini ./
COPY migrations/ ./migrations/
COPY fixtures/ ./fixtures/
COPY src/ ./src/
CMD ["uvicorn", "blueprint.main:app", "--host", "0.0.0.0", "--port", "8000"]

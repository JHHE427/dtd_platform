#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${DTDISMIND_ROOT:-/opt/dtdismind}"
APP_DIR="${APP_ROOT}/app"
DB_PATH="${DTD_DB_PATH:-${APP_ROOT}/data/dtd_network.sqlite}"
LOG_DIR="${APP_ROOT}/logs/dtd_runtime_logs"
PYTHON_ENV="${DTDISMIND_PYTHON_ENV:-/opt/conda/envs/dtd}"
PORT="${DTDISMIND_PORT:-8099}"

mkdir -p "${LOG_DIR}"
cd "${APP_DIR}"
export DTD_DB_PATH="${DB_PATH}"

exec "${PYTHON_ENV}/bin/uvicorn" app:app \
  --app-dir "${APP_DIR}" \
  --host 0.0.0.0 \
  --port "${PORT}"

#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${DISEASEMIND_ROOT:-/home/admin1/diseasemind}"
APP_DIR="${APP_ROOT}/app"
DB_PATH="${DTD_DB_PATH:-${APP_ROOT}/data/dtd_network.sqlite}"
LOG_DIR="${APP_ROOT}/logs/dtd_runtime_logs"
PYTHON_ENV="${DISEASEMIND_PYTHON_ENV:-/home/admin1/miniforge3/envs/dtd}"
PORT="${DISEASEMIND_PORT:-8099}"

mkdir -p "${LOG_DIR}"
cd "${APP_DIR}"
export DTD_DB_PATH="${DB_PATH}"

exec "${PYTHON_ENV}/bin/uvicorn" app:app \
  --app-dir "${APP_DIR}" \
  --host 0.0.0.0 \
  --port "${PORT}"

# DTDisMind Deployment Guide

Current public production URL:

- `https://tmliang.cn/dtdismind/`

Recommended production layout for a clean host:

- Project root: `/opt/dtdismind`
- Application code: `/opt/dtdismind/app`
- Database: `/opt/dtdismind/data/dtd_network.sqlite`
- Runtime logs: `/opt/dtdismind/logs/dtd_runtime_logs/uvicorn_8099.log`
- Python environment: `/opt/conda/envs/dtd` or another environment with `requirements.txt`
- Internal app port: `8099`

## Build Frontend

```bash
cd /opt/dtdismind/app/frontend
npm install
npm run build
```

The Vite build writes production assets into `/opt/dtdismind/app/static`.
The frontend is configured for the `/dtdismind/` subpath.

## Run Backend

```bash
DTD_DB_PATH=/opt/dtdismind/data/dtd_network.sqlite \
  /opt/conda/envs/dtd/bin/uvicorn app:app \
  --app-dir /opt/dtdismind/app \
  --host 0.0.0.0 \
  --port 8099
```

The backend also falls back to `../data/dtd_network.sqlite` when it is started from the application directory and `DTD_DB_PATH` is not set.

## Detached Restart

```bash
ps -ef | awk '/[u]vicorn app:app/ && /8099/ {print $2}' | xargs -r kill

DTD_DB_PATH=/opt/dtdismind/data/dtd_network.sqlite \
  setsid /opt/conda/envs/dtd/bin/uvicorn app:app \
  --app-dir /opt/dtdismind/app \
  --host 0.0.0.0 \
  --port 8099 \
  >> /opt/dtdismind/logs/dtd_runtime_logs/uvicorn_8099.log 2>&1 < /dev/null &
```

## Run Script

The bundled script reads these optional variables:

```bash
DTDISMIND_ROOT=/opt/dtdismind \
DTD_DB_PATH=/opt/dtdismind/data/dtd_network.sqlite \
DTDISMIND_PYTHON_ENV=/opt/conda/envs/dtd \
DTDISMIND_PORT=8099 \
/opt/dtdismind/app/deploy/run_production.sh
```

## Nginx

The active nginx config should proxy the public subpath to the internal app:

```nginx
location /dtdismind/ {
    proxy_pass http://127.0.0.1:8099/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_read_timeout 300;
}
```

## Smoke Test

```bash
curl http://127.0.0.1:8099/api/health
curl "http://127.0.0.1:8099/api/results/predictions?page=1&page_size=1"
curl -k https://tmliang.cn/dtdismind/
```

Also test Home, Analysis, Database, Help, graph load, search, export, API health, and favicon in a browser.

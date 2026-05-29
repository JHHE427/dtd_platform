# DiseaseMind Deployment Guide

Current production URL:

- `https://tmliang.cn/diseasemind/`

Current production layout:

- Project root: `/home/admin1/diseasemind`
- Application code: `/home/admin1/diseasemind/app`
- Database: `/home/admin1/diseasemind/data/dtd_network.sqlite`
- Runtime logs: `/home/admin1/diseasemind/logs/dtd_runtime_logs/uvicorn_8099.log`
- Python environment: `/home/admin1/miniforge3/envs/dtd`
- Internal app port: `8099`

## Build Frontend

```bash
cd /home/admin1/diseasemind/app/frontend
npm install
npm run build
```

The Vite build writes production assets into `/home/admin1/diseasemind/app/static`.
The frontend is configured for the `/diseasemind/` subpath.

## Run Backend

```bash
DTD_DB_PATH=/home/admin1/diseasemind/data/dtd_network.sqlite \
  /home/admin1/miniforge3/envs/dtd/bin/uvicorn app:app \
  --app-dir /home/admin1/diseasemind/app \
  --host 0.0.0.0 \
  --port 8099
```

The backend also falls back to `../data/dtd_network.sqlite` when it is started from
`/home/admin1/diseasemind/app` and `DTD_DB_PATH` is not set.

## Detached Restart

```bash
ps -ef | awk '/[u]vicorn app:app/ && /8099/ {print $2}' | xargs -r kill

DTD_DB_PATH=/home/admin1/diseasemind/data/dtd_network.sqlite \
  setsid /home/admin1/miniforge3/envs/dtd/bin/uvicorn app:app \
  --app-dir /home/admin1/diseasemind/app \
  --host 0.0.0.0 \
  --port 8099 \
  >> /home/admin1/diseasemind/logs/dtd_runtime_logs/uvicorn_8099.log 2>&1 < /dev/null &
```

## Nginx

The active nginx config proxies the public subpath to the internal app:

```nginx
location /diseasemind/ {
    proxy_pass http://127.0.0.1:8099/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Smoke Test

```bash
curl http://127.0.0.1:8099/api/health
curl "http://127.0.0.1:8099/api/results/predictions?page=1&page_size=1"
curl -k --resolve tmliang.cn:443:127.0.0.1 https://tmliang.cn/diseasemind/
```

Also test Home, Analysis, Database, Help, graph load, search, and favicon in the browser.

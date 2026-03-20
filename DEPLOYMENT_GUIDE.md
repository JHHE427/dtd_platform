# DTD Atlas Deployment Guide

## 1. Server Prerequisites

- Ubuntu 22.04 or similar Linux distribution
- Python 3.10+
- Node 18+
- `nginx`
- Optional but recommended: `python3-venv`

## 2. Upload Project

Upload the entire folder to the server, for example:

- Project root: `/srv/dtd_platform`
- Database path: `/srv/dtd_data/dtd_network.sqlite`

## 3. Install Backend Dependencies

```bash
cd /srv/dtd_platform
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

## 4. Build Frontend

```bash
cd /srv/dtd_platform/frontend
npm install
npm run build
```

This writes production assets into `/srv/dtd_platform/static`.

## 5. Environment Variable

The backend reads:

- `DTD_DB_PATH`

Example:

```bash
export DTD_DB_PATH=/srv/dtd_data/dtd_network.sqlite
```

## 6. Local Server Test

```bash
cd /srv/dtd_platform
source .venv/bin/activate
DTD_DB_PATH=/srv/dtd_data/dtd_network.sqlite uvicorn app:app --host 127.0.0.1 --port 8787
```

Check:

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/ready
```

## 7. systemd Service

Copy the template from:

- `deploy/systemd/dtd-atlas.service`

Then update:

- `User`
- `Group`
- project path
- venv path
- `DTD_DB_PATH`

Enable it:

```bash
sudo cp deploy/systemd/dtd-atlas.service /etc/systemd/system/dtd-atlas.service
sudo systemctl daemon-reload
sudo systemctl enable dtd-atlas
sudo systemctl start dtd-atlas
sudo systemctl status dtd-atlas
```

## 8. Nginx Reverse Proxy

Copy the template from:

- `deploy/nginx/dtd-atlas.conf`

Then update:

- `server_name`
- optional TLS certificate paths

Enable it:

```bash
sudo cp deploy/nginx/dtd-atlas.conf /etc/nginx/sites-available/dtd-atlas
sudo ln -s /etc/nginx/sites-available/dtd-atlas /etc/nginx/sites-enabled/dtd-atlas
sudo nginx -t
sudo systemctl reload nginx
```

## 9. HTTPS

If you have a domain:

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example
```

## 10. Final Smoke Test

- Open the domain in browser
- Test Home / Analysis / Database / Help
- Test one Drug search
- Test one Target search
- Test one Disease search
- Test graph load
- Test compare drugs
- Test export CSV

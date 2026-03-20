# DTD Atlas Pre-Launch QA Checklist

## 1. Startup

- [ ] `python3 -m pip install -r requirements.txt` succeeds
- [ ] `cd frontend && npm install && npm run build` succeeds
- [ ] `uvicorn app:app --host 0.0.0.0 --port 8787` starts without traceback
- [ ] Open `http://127.0.0.1:8787` and verify no blank page
- [ ] Browser console has no blocking runtime error

## 2. API Smoke Test

- [ ] `GET /api/health` returns `ok: true`
- [ ] `GET /api/ready` returns `ok: true`
- [ ] `GET /api/meta/stats` returns node and edge stats
- [ ] `GET /api/nodes?page=1&page_size=5` returns data
- [ ] `GET /api/edges?page=1&page_size=5` returns data
- [ ] `GET /api/suggest?q=gefi` returns suggestions
- [ ] `GET /api/search?q=Gefitinib&limit=3` returns at least one node

## 3. Navigation

- [ ] `Home` loads with overview stats
- [ ] `Analysis` loads without blank screen
- [ ] `Database` loads node and edge browser
- [ ] `Help` loads and scrolls correctly
- [ ] Header quick search works from every page

## 4. Analysis Page

- [ ] Enter a valid node ID and `Load Graph` works
- [ ] `Fit View` works
- [ ] `Expand Selected` works after selecting a node
- [ ] `Dense` and `All` graph actions work
- [ ] `Compare` shows core/full edge count result
- [ ] Graph supports wheel zoom, drag canvas, node click, node double-click
- [ ] Hover card appears on node hover

## 5. Node Detail

- [ ] Drug node shows SMILES, description, ontology, safety, summaries
- [ ] Missing drug structure/SMILES shows reason text
- [ ] Drug structure `Zoom` works
- [ ] Drug structure `Download PNG` works
- [ ] Target node shows UniProt link when available
- [ ] Target sequence `Copy Sequence` works
- [ ] Missing target UniProt/sequence shows reason text
- [ ] Disease node loads edge stats and neighbor list correctly

## 6. New Pisces-Inspired Features

- [ ] `Multi-Modal Profile` shows coverage, quality score, quality tier
- [ ] Missing modalities list is visible when applicable
- [ ] `Mechanism Snapshot` shows top linked nodes
- [ ] `Mechanism Snapshot` shows evidence sources
- [ ] `Mechanism Snapshot` shows context summary
- [ ] Drug pair comparison works with two valid Drug IDs
- [ ] Shared target chips are clickable
- [ ] Shared disease chips are clickable
- [ ] `Load Compare Subgraph` loads a compare network instead of blank graph

## 7. Path Finder

- [ ] Valid source and target return a path
- [ ] Invalid or disconnected pairs show a clean error toast
- [ ] Path result replaces graph with path subgraph

## 8. Database Page

- [ ] Node search works
- [ ] Edge search works
- [ ] Node pagination works
- [ ] Edge pagination works
- [ ] Export nodes works
- [ ] Export edges works
- [ ] Clicking a node jumps to Analysis page

## 9. Data Quality Spot Check

- [ ] Drug annotations are present for a small molecule drug
- [ ] Drug annotations are present for a biologic drug
- [ ] Target annotations are present for a protein target
- [ ] Target missing-sequence reason appears for a non-protein target
- [ ] Disease annotations are present for a disease node
- [ ] Structure directory contains local files under `static/structures`

## 10. Deployment Readiness

- [ ] `DTD_DB_PATH` points to the production database file
- [ ] Port and domain are decided
- [ ] `systemd` service file is updated with the real server path/user
- [ ] `nginx` config is updated with the real domain
- [ ] HTTPS certificate plan is ready
- [ ] Firewall/security group opens `80/443`

# NyaGallery

[中文首页](docs/README_CN.md)

NyaGallery is a self-hosted illustration gallery for archiving, browsing, tagging, and syncing image collections. It has a FastAPI backend, a Next.js frontend, immutable original storage, rebuildable metadata/indexes, Pixiv sync, user roles, API tokens, media cache generation, and optional Redis/PostgreSQL support for larger deployments.

## Documentation Map

| Document | Role |
| --- | --- |
| [README.md](README.md) | Project home, quick setup, and development notes. |
| [READMORE.md](READMORE.md) | Full English backend, storage, tags, Pixiv, API, and test reference. |
| [docs/README_CN.md](docs/README_CN.md) | 中文项目首页、快速上手和开发说明。 |
| [docs/READMORE_CN.md](docs/READMORE_CN.md) | 中文完整后端、存储、标签、Pixiv、API 与测试说明。 |
| [docs/QUICKSTART_CN.md](docs/QUICKSTART_CN.md) | 中文简洁部署步骤和常用命令。 |
| [docs/USAGE_CN.md](docs/USAGE_CN.md) | 中文完整使用手册、API 示例、维护流程和 FAQ。 |
| [docs/summary.md](docs/summary.md) | 中文当前实现、模块边界和后续方向总结。 |
| [frontend/README.md](frontend/README.md) | Frontend architecture, pages, hooks, API mapping, and build notes. |
| [config.example.toml](config.example.toml) | Example backend deployment configuration. |

## Requirements

- Python 3.11+
- Node.js 18+
- npm
- Optional: PostgreSQL, Redis, Pixiv refresh token, media/Pixiv extras

## Quick Start

Install the backend:

```powershell
python -m pip install -e ".[media,pixiv,pixiv-login,postgres,redis]"
```

Install the frontend:

```powershell
cd frontend
npm install
cd ..
```

Create storage, the tag catalog, the database, and an admin account:

```powershell
nyagallery --storage storage setup --username admin --role admin --password 123123
```

Run the backend:

```powershell
nyagallery --storage storage serve --host 127.0.0.1 --port 8001
```

Run the frontend in another terminal:

```powershell
cd frontend
$env:NYA_API_BACKEND = "http://127.0.0.1:8001"
npm run dev
```

Open:

```text
http://localhost:3000
```

## Configuration

Copy the example config when you want a reusable deployment config:

```powershell
Copy-Item config.example.toml nyagallery.toml
nyagallery --config nyagallery.toml serve
```

Important sections:

- `[core]`: storage root, database URL, optional tag catalog path
- `[server]`: host, port, access log, secure cookie mode
- `[site]`: project homepage, repository link, optional ICP filing number
- `[pixiv]`: optional default Pixiv credentials and sync defaults
- `[redis]`: optional Redis URL and shared security limiter

## Common Commands

Rebuild the database index:

```powershell
nyagallery --storage storage rebuild-db
```

Generate media cache:

```powershell
nyagallery --storage storage generate-cache
```

Sync a Pixiv artwork:

```powershell
nyagallery --storage storage pixiv-sync-pid 123456 --generate-cache --rebuild-db
```

Create a user:

```powershell
nyagallery --storage storage create-user viewer --role viewer --password 123123
```

Issue an API token:

```powershell
nyagallery --storage storage issue-token viewer
```

## Development

Backend checks:

```powershell
python -m py_compile src/nyagallery/*.py
python -m unittest tests.test_config tests.test_tags tests.test_db
```

Frontend checks:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run build
```

Recommended full development install:

```powershell
python -m pip install -e ".[dev,media,pixiv,pixiv-login,postgres,redis]"
```

## Release Notes

Include source files and docs:

- `src/`
- `frontend/`
- `pyproject.toml`
- `config.example.toml`
- `README.md`, `READMORE.md`, `docs/README_CN.md`, `docs/READMORE_CN.md`, `docs/QUICKSTART_CN.md`, `docs/USAGE_CN.md`, `docs/summary.md`, `frontend/README.md`
- `LICENSE`

Do not include runtime/cache folders:

- `storage/`
- `frontend/node_modules/`
- `frontend/.next/`
- `frontend/tsconfig.tsbuildinfo`
- `dist/`, `build/`, `*.egg-info/`

## Architecture Notes

Original files are immutable. Metadata and database indexes are rebuildable from `storage/original`, `storage/metadata`, and the tag catalog. Tag labels, aliases, implications, and source-site tags are backend-owned so multiple frontends or future distributed backends can share the same tag semantics.

# StyleMe

AI-powered personal wardrobe assistant that turns your closet into a smart, searchable, style-aware database. Upload photos of your clothes, describe an event, and get outfit recommendations from what you already own.

Built with **FastAPI** + **Next.js** + **Gemini** (vision & embeddings) + **HydraDB** (semantic memory & vector search).

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  frontend/          Next.js 16 · React 19 · Tailwind 4   │
│  (App)              Upload · Wardrobe · Recommend · Chat  │
├──────────────────────────────────────────────────────────┤
│  website/           Next.js 16 · Landing / marketing page │
├──────────────────────────────────────────────────────────┤
│  backend/           FastAPI · Python 3.12+                │
│                     Gemini Vision → garment metadata      │
│                     Gemini Embeddings → 768-dim vectors   │
│                     HydraDB → memory + vector store       │
│                     SAM 3 → garment segmentation          │
│                     InsightFace → face-grounded filtering  │
└──────────────────────────────────────────────────────────┘
```

## Quick start

```bash
git clone https://github.com/kevalshah14/StyleMe.git
cd StyleMe
./setup.sh          # installs deps, creates env files, prints next steps
```

The only manual step: add your `GEMINI_API_KEY` to `backend/.env`.

### Manual setup

```bash
# Backend
cd backend
cp .env.example .env      # then add your GEMINI_API_KEY
uv sync

# Frontend (separate terminal)
cd frontend
npm install
```

### Run

```bash
# Terminal 1 — backend
cd backend
uv run uvicorn main:app --reload --port 8001

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open the URL shown by Next.js (usually `http://localhost:3000`).

## Environment variables

### `backend/.env`

Copy from `.env.example`. Minimum required:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key ([get one](https://aistudio.google.com/apikey)) |
| `JWT_SECRET` | Yes | Random string for signing auth tokens |
| `HYDRADB_API_KEY` | No | HydraDB vector DB key |
| `CORS_ORIGINS` | No | Allowed origins (default `*`) |

See `backend/.env.example` for the full list of optional configuration.

### `frontend/.env.local`

Auto-created by `npm run dev` via the predev script. Override manually if needed:

```env
BETTER_AUTH_SECRET=<random-secret>
BETTER_AUTH_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001
```

## Project layout

```
StyleMe/
├── backend/            Python API (FastAPI, uv)
│   ├── main.py         App entrypoint (CORS + router registration only)
│   ├── core/           Shared infrastructure (config, auth)
│   ├── routers/        API route handlers (one file per domain)
│   ├── services/       All business logic + AI pipelines
│   │   ├── scraper.py, embedder.py, stylist.py   Gemini AI services
│   │   ├── segmentor.py, annotator.py, tryon.py  SAM 3 + try-on pipeline
│   │   ├── identity.py, profile.py               Face ID + user photos
│   │   └── wardrobe.py, local_cache.py, ingest.py  Data layer
│   ├── models/         Pydantic schemas
│   └── scripts/        Utility scripts (seed_wardrobe.py)
├── frontend/           Main app (Next.js 16, React 19, TypeScript, Tailwind 4)
│   └── src/
│       ├── app/        Pages (upload, wardrobe)
│       ├── components/ UI components
│       └── lib/        API client, auth, types, utils
├── website/            Landing page (Next.js 16)
├── docs/               Product requirements (PRD)
└── setup.sh            One-command setup script
```

## User flow

1. **Sign up** — create an account (Better Auth)
2. **Onboard** — enter name, upload full-body photo + selfie
3. **Upload** — photograph your clothes; AI extracts metadata (type, color, pattern, formality, etc.)
4. **Wardrobe** — browse, search, and manage your digital closet
5. **Recommend** — describe an event, get AI-styled outfit picks from your wardrobe
6. **Try-on** — virtual try-on compositing via Gemini image generation

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Python 3.12+, FastAPI, uvicorn |
| AI / Vision | Gemini Flash (garment extraction, outfit styling, virtual try-on) |
| AI / Embeddings | Gemini text-embedding (768-dim BYOE vectors) |
| Database | HydraDB (semantic memory, hybrid recall, raw embedding search) |
| Segmentation | Meta SAM 3 via Ultralytics |
| Face ID | InsightFace ONNX (local, no cloud face API) |
| Auth | Better Auth (frontend) + JWT (backend API) |
| Package mgmt | uv (backend), npm (frontend) |

## License

Private — not yet open-sourced.

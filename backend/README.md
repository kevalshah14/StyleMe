# StyleMe — Backend

FastAPI application serving the StyleMe AI wardrobe assistant. Handles garment analysis, embedding generation, wardrobe management, outfit recommendations, segmentation, and virtual try-on.

## Setup

```bash
cd backend
cp .env.example .env      # fill in GEMINI_API_KEY at minimum
uv sync                   # install dependencies
```

### Run

```bash
uv run uvicorn main:app --reload --port 8001
```

Or directly:

```bash
uv run python main.py
```

Swagger docs available at `http://localhost:8001/docs`.

## Environment

See `.env.example` for the full list. Key variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key |
| `JWT_SECRET` | Yes | — | Secret for signing JWT auth tokens |
| `HYDRADB_API_KEY` | No | — | HydraDB vector database key |
| `CORS_ORIGINS` | No | `*` | Comma-separated allowed origins |
| `SAM3_WEIGHTS` | No | `sam3.pt` | Path to SAM 3 model weights |

## Project structure

```
backend/
├── main.py                 App entrypoint — CORS, router registration (no inline routes)
├── core/
│   ├── config.py           Pydantic Settings (loads from .env)
│   └── auth.py             JWT generation, verification, get_current_user dependency
├── routers/
│   ├── auth_router.py      POST /api/auth/* — register, login, onboard
│   ├── upload_router.py    POST /api/upload — clothing photo upload + AI scraping
│   ├── wardrobe_router.py  GET/DELETE /api/wardrobe — browse & manage (auth-scoped)
│   ├── recommend_router.py POST /api/recommend — event → outfit recommendations
│   ├── chat_router.py      POST /api/chat — conversational wardrobe assistant
│   ├── segment_router.py   POST /api/segment, /api/segment/me, /api/identity/enroll
│   ├── tryon_router.py     POST /api/try-on, /api/try-on/wardrobe
│   ├── store_router.py     POST /api/store + unauthenticated wardrobe/chat endpoints
│   ├── inspect_router.py   GET /api/inspect — HydraDB data inspection
│   ├── preferences_router.py  Style DNA / preferences
│   └── health_router.py    GET /api/health — healthcheck
├── services/
│   ├── scraper.py          Gemini Vision garment metadata extraction
│   ├── embedder.py         Gemini text-embedding generation (768-dim)
│   ├── stylist.py          Gemini outfit recommendation logic
│   ├── wardrobe.py         HydraDB wardrobe CRUD (memory + embeddings)
│   ├── chat.py             Conversational AI service
│   ├── ingest.py           Garment ingestion pipeline (segment → label → cluster → store)
│   ├── local_cache.py      Local JSON cache fallback + keyword/semantic search
│   ├── learning.py         Style preference tracking
│   ├── segmentor.py        SAM 3 garment segmentation engine
│   ├── annotator.py        Gemini Flash-Lite segment labeling
│   ├── tryon.py            Gemini image generation for virtual try-on
│   ├── identity.py         InsightFace face enrollment + matching
│   └── profile.py          User profile photo storage
├── models/
│   ├── garment.py          Garment Pydantic schemas
│   ├── outfit.py           Outfit recommendation schemas
│   ├── event.py            Event input schemas
│   └── user.py             User/auth schemas
├── scripts/
│   └── seed_wardrobe.py    Seed demo wardrobe data
├── pyproject.toml          Dependencies (managed by uv)
└── .env.example            Environment variable template
```

## API overview

All authenticated endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | No | Create a new user |
| `POST` | `/api/auth/login` | No | Login with user_id |
| `POST` | `/api/auth/onboard` | No | Complete onboarding (name, photos) |
| `POST` | `/api/upload` | Yes | Upload clothing photos for AI analysis |
| `GET` | `/api/wardrobe` | Yes | List wardrobe items |
| `POST` | `/api/wardrobe/confirm` | Yes | Save confirmed garments |
| `DELETE` | `/api/wardrobe/{id}` | Yes | Remove a garment |
| `POST` | `/api/recommend` | Yes | Get outfit recommendations for an event |
| `POST` | `/api/recommend/accept` | Yes | Record outfit preference |
| `POST` | `/api/recommend/search` | Yes | Embedding search over wardrobe |
| `POST` | `/api/chat` | Yes | Chat with the AI stylist |
| `POST` | `/api/segment` | No | Segment garments from an image (SAM 3) |
| `POST` | `/api/segment/me` | Yes | Face-grounded segmentation |
| `POST` | `/api/identity/enroll` | Yes | Enroll face embedding |
| `POST` | `/api/try-on` | No | Virtual try-on from two photos |
| `POST` | `/api/try-on/wardrobe` | No | Virtual try-on from wardrobe items |
| `POST` | `/api/store` | No | Store pre-segmented items |
| `GET` | `/api/health` | No | Service healthcheck |
| `GET` | `/api/inspect/*` | Yes | HydraDB data inspection |
| `GET` | `/api/preferences/style-dna` | Yes | Style DNA analytics |

## Dependencies

Managed with [uv](https://docs.astral.sh/uv/) via `pyproject.toml`. Key packages:

- **fastapi** + **uvicorn** — async web framework
- **google-genai** — Gemini Vision, embeddings, and image generation
- **hydra-db-python** — HydraDB semantic memory and vector search
- **ultralytics** — SAM 3 segmentation
- **pillow** — image processing
- **python-jose** — JWT authentication
- **insightface** (optional) — face enrollment and matching

## Optional: SAM 3 segmentation

Download `sam3.pt` from [Hugging Face](https://huggingface.co/facebook/sam3) (gated access) and place it in `backend/weights/`:

```bash
# After getting access on Hugging Face:
mv ~/Downloads/sam3.pt backend/weights/sam3.pt
```

Or set `SAM3_WEIGHTS` in `.env` to point elsewhere. Required for `/api/segment` and `/api/try-on` endpoints.

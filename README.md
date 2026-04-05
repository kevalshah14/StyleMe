# StyleMe

Monorepo with a Python backend and a Next.js frontend.

## Prerequisites

- **Backend:** Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- **Frontend:** Node.js 20+ and npm

## Environment (backend)

Segmentation uses **Meta SAM 3** via Ultralytics ([`docs/SAM3.md`](docs/SAM3.md)) with the fixed text concept **`clothes`** so all matching garment instances are segmented. Detections below **60% confidence** are dropped by default (`SAM3_MIN_CONFIDENCE` in `.env`). Each run saves **RGBA cutouts** and **`segments.json`** (metadata per PNG, no base64 masks) under `backend/segments/<timestamp>/` (override with `SEGMENTS_OUTPUT_DIR`; set `SAVE_SEGMENTS=0` to turn off). Optional **Gemini** labels per segment: set `GEMINI_API_KEY` and call `POST /api/segment` with form field `annotate=true` (uses `gemini-3.1-flash-lite-preview` by default). **Virtual try-on**: `POST /api/try-on` with multipart fields `user` and `outfit` (images); segments the outfit (**same disk export** as `/api/segment` when `SAVE_SEGMENTS` is on), then uses **Gemini 3.1 Flash Image** (`GEMINI_IMAGE_MODEL`, default `gemini-3.1-flash-image-preview`) to composite **all** detected garment segments (up to `TRYON_MAX_SEGMENTS`, default 14, ordered head-to-toe) onto the person. You must download **`sam3.pt`** from [Hugging Face `facebook/sam3`](https://huggingface.co/facebook/sam3) (gated access), then set `SAM3_WEIGHTS` in `backend/.env` or put the file in the backend working directory. Dependencies include **`timm`** and Ultralytics’ **`clip`** (see `pyproject.toml`).

Copy `backend/.env.example` to `backend/.env` for paths and server options.

### Face-grounded “my clothes only” segmentation

The API can store a **per-user face embedding** (local InsightFace ONNX, no cloud face API) and run **`POST /api/segment/me`** so SAM 3 `clothes` masks are **filtered** to the person whose face best matches the enrolled user (useful for group photos). Flow: sign in (same JWT as the wardrobe app), **`POST /api/identity/enroll`** with a clear selfie, then **`POST /api/segment/me`** with the group image and `Authorization: Bearer <token>`. Tune **`FACE_MATCH_MIN`** and **`MASK_OVERLAP_MIN`** in `.env`. Embeddings live under `backend/data/identity/`; ONNX weights download under `backend/.insightface/` on first use. This stores **biometric-derived vectors** server-side—document retention and align with your privacy policy.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/kevalshah14/StyleMe.git
cd StyleMe

# 2. Backend setup
cd backend
cp .env.example .env          # then edit .env and add your GEMINI_API_KEY
uv sync

# 3. Frontend setup (new terminal)
cd frontend
npm install
cp .env.local.example .env.local   # or create manually (see below)
```

### Environment files

**`backend/.env`** — copy from `.env.example`, fill in at minimum:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key ([get one](https://aistudio.google.com/apikey)) |
| `JWT_SECRET` | Yes | Random string for signing auth tokens |
| `CORS_ORIGINS` | No | Allowed origins, default `*` |
| `HYDRADB_API_KEY` | No | HydraDB vector DB key (optional) |

**`frontend/.env.local`** — create with:

```env
BETTER_AUTH_SECRET=<random-secret>     # run: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3001   # match your Next.js dev port
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001  # match your backend port
```

### Run

**Terminal 1 — Backend:**

```bash
cd backend
uv run uvicorn main:app --reload --port 8001
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Open the URL shown by Next.js (usually `http://localhost:3000` or `3001`).

### Onboarding Flow

1. **Sign Up** — Create an account with email and password (Better Auth)
2. **Name** — Enter your display name
3. **Full-body Photo** — Upload a full-length photo (used for virtual try-on)
4. **Selfie** — Upload a selfie (used for face enrollment via InsightFace)

After onboarding, you can upload wardrobe photos, get outfit recommendations, and try on outfits virtually.

## Backend (details)

```bash
cd backend
uv sync
uv run python main.py          # or: uv run uvicorn main:app --reload --port 8001
```

Dependencies and the lockfile are managed with `uv` (`pyproject.toml`, `uv.lock`).

## Frontend (details)

```bash
cd frontend
npm install   # first time, or after dependency changes
npm run dev
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Project layout

| Path        | Description                    |
| ----------- | ------------------------------ |
| `backend/`  | Python app (`uv`, `main.py`)   |
| `frontend/` | Next.js 16 (App Router, React 19, TypeScript, Tailwind) |

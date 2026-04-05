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

## Backend

```bash
cd backend
uv sync
uv run python main.py
```

Dependencies and the lockfile are managed with `uv` (`pyproject.toml`, `uv.lock`).

## Frontend

```bash
cd frontend
npm install   # first time, or after dependency changes
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Project layout

| Path        | Description                    |
| ----------- | ------------------------------ |
| `backend/`  | Python app (`uv`, `main.py`)   |
| `frontend/` | Next.js 16 (App Router, React 19, TypeScript, Tailwind) |

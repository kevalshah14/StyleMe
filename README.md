# StyleMe

Monorepo with a Python backend and a Next.js frontend.

## Prerequisites

- **Backend:** Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- **Frontend:** Node.js 20+ and npm

## Environment (backend)

The backend uses a **Gemini API key** for Google AI. Create a local env file from the template:

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set `GEMINI_API_KEY` to your key from [Google AI Studio](https://aistudio.google.com/apikey). The real `.env` file is gitignored; only `.env.example` is committed.

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

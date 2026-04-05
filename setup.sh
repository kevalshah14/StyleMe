#!/usr/bin/env bash
set -euo pipefail

# StyleMe — one-command setup
# Usage: ./setup.sh

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[setup]${NC} $1"; }
info() { echo -e "${CYAN}[setup]${NC} $1"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Check prerequisites ──────────────────────────────────────────

log "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  echo "Node.js is required. Install it from https://nodejs.org (v20+)"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "Python 3.12+ is required."
  exit 1
fi

if ! command -v uv &>/dev/null; then
  warn "uv not found. Installing..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

# ── Backend setup ─────────────────────────────────────────────────

log "Setting up backend..."
cd "$ROOT/backend"

if [ ! -f .env ]; then
  cp .env.example .env
  warn "Created backend/.env from .env.example"
  warn "Edit backend/.env and add your GEMINI_API_KEY before running."
else
  info "backend/.env already exists, skipping."
fi

uv sync
log "Backend dependencies installed."

# ── Frontend setup ────────────────────────────────────────────────

log "Setting up frontend..."
cd "$ROOT/frontend"

npm install

# Auto-create .env.local if missing (same as predev script)
node scripts/ensure-env.js

log "Frontend dependencies installed."

# ── Done ──────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Setup complete!${NC}"
echo ""
echo "To start the app:"
echo ""
echo -e "  ${CYAN}Terminal 1 (backend):${NC}"
echo "    cd backend && uv run uvicorn main:app --reload --port 8001"
echo ""
echo -e "  ${CYAN}Terminal 2 (frontend):${NC}"
echo "    cd frontend && npm run dev"
echo ""
echo -e "  ${YELLOW}Don't forget:${NC} Add your GEMINI_API_KEY to backend/.env"
echo ""

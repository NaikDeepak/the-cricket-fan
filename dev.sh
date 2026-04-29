#!/usr/bin/env bash
# dev.sh — start the full Cricket Fan dev environment
# Run from the worktree root: bash dev.sh
# Ctrl-C kills everything cleanly.

set -euo pipefail

WORKTREE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$WORKTREE_DIR/backend"
FRONTEND_DIR="$WORKTREE_DIR/frontend"
VENV="$BACKEND_DIR/.venv/bin/activate"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── cleanup on Ctrl-C ────────────────────────────────────────────────────────
cleanup() {
  echo ""
  warn "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  docker compose -f "$WORKTREE_DIR/docker-compose.yml" stop db 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# ── 1. Docker ─────────────────────────────────────────────────────────────────
echo "── Step 1: Postgres ──────────────────────────────────────────────────────"
if ! docker info &>/dev/null; then
  die "Docker daemon not running. Open Docker Desktop, then re-run this script."
fi

docker compose -f "$WORKTREE_DIR/docker-compose.yml" up -d db
ok "Postgres container started"

# Wait until Postgres is accepting connections (max 30s)
echo -n "   Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker compose -f "$WORKTREE_DIR/docker-compose.yml" exec -T db \
      pg_isready -U cricket -d cricket_fan -p 5432 &>/dev/null; then
    echo " ready."
    break
  fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    die "Postgres did not become ready in 30 seconds."
  fi
done

# ── 2. Python venv ────────────────────────────────────────────────────────────
echo "── Step 2: Python venv ───────────────────────────────────────────────────"
if [[ ! -f "$VENV" ]]; then
  warn "No venv found — creating one now..."
  python3 -m venv "$BACKEND_DIR/.venv"
fi
# shellcheck source=/dev/null
source "$VENV"
pip install -q -r "$BACKEND_DIR/requirements.txt"
ok "venv ready"

# ── 3. Seed (idempotent — schedule first, then player stats) ─────────────
echo "── Step 3: Seed dev data ─────────────────────────────────────────────────"
(cd "$BACKEND_DIR" && python -m scripts.seed_schedule)
ok "Schedule seeded (70 fixtures, 10 teams)"
(cd "$BACKEND_DIR" && python -m scripts.ingest_cricsheet)
ok "Cricsheet stats ingested (players, PvP, venue)"

# ── 4. Backend ────────────────────────────────────────────────────────────────
echo "── Step 4: Backend (port 8000) ───────────────────────────────────────────"
(cd "$BACKEND_DIR" && uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!
ok "Backend starting (PID $BACKEND_PID)"

# Give FastAPI a moment to boot before frontend starts
sleep 2

# ── 5. Frontend ───────────────────────────────────────────────────────────────
echo "── Step 5: Frontend (port 3000) ──────────────────────────────────────────"
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!
ok "Frontend starting (PID $FRONTEND_PID)"

# ── Ready ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Cricket Fan dev environment is up${NC}"
echo -e "${GREEN}  Frontend  →  http://localhost:3000${NC}"
echo -e "${GREEN}  Backend   →  http://localhost:8000${NC}"
echo -e "${GREEN}  API docs  →  http://localhost:8000/docs${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Press Ctrl-C to stop everything."
echo ""

# Keep script alive until Ctrl-C
wait

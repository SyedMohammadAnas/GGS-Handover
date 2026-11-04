#!/usr/bin/env bash
# Shows whether every part of the system is running and answering.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[[ -f .env ]] || { echo "No installation found (.env missing). Run ./install.sh first."; exit 1; }

echo "== Containers"
docker compose ps

check() { # name, command...
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then printf '  OK    %s\n' "$name"; else printf '  FAIL  %s\n' "$name"; fi
}

echo
echo "== Health"
check "sign-in service"      curl -fsS http://127.0.0.1:8000/auth/v1/health
check "API"                  docker compose exec -T api wget -qO- http://localhost:3000/health
check "web console"          docker compose exec -T expert wget -qO- http://localhost:3002/login
check "database"             docker compose exec -T db pg_isready -U postgres -h localhost

echo
echo "If something shows FAIL:  docker compose logs <name>   (auth, api, expert, livekit, db, gateway, caddy)"

#!/usr/bin/env bash
# Backs up the database and the uploaded 3D models into ./backups/<timestamp>/.
# Also copy your .env somewhere safe — without it a backup cannot be restored.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[[ -f .env ]] || { echo "No installation found (.env missing)."; exit 1; }

stamp="$(date +%Y%m%d-%H%M%S)"
dir="backups/$stamp"
mkdir -p "$dir"

docker compose exec -T db pg_dump -U postgres -d postgres --clean --if-exists \
  --schema=public --schema=auth > "$dir/database.sql"
tar -C data -czf "$dir/assets.tar.gz" assets
cp .env "$dir/env.backup"
chmod 600 "$dir/env.backup"

echo "Backup written to $dir"
echo "Keep it somewhere other than this server."

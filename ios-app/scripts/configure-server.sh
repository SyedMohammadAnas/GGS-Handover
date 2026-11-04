#!/usr/bin/env bash
# Point the iOS app at your server.
#
# Usage:  ./scripts/configure-server.sh /path/to/client-config.txt
#
# client-config.txt is produced by the installer (install/install.sh) and holds lines like
#   SUPABASE_URL=https://sb.example.com
# Only the public values the app needs are in that file.
set -euo pipefail

cfg="${1:-}"
if [[ -z "$cfg" || ! -f "$cfg" ]]; then
  echo "Usage: $0 /path/to/client-config.txt" >&2
  exit 1
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="$here/GGSApple/Config/ServerConfig.swift"
[[ -f "$target" ]] || { echo "Cannot find $target" >&2; exit 1; }

keys=(SUPABASE_URL SUPABASE_ANON_KEY API_URL LIVEKIT_URL EXPERT_URL)

for key in "${keys[@]}"; do
  value="$(grep -E "^${key}=" "$cfg" | head -1 | cut -d= -f2-)"
  if [[ -z "$value" ]]; then
    echo "Missing $key in $cfg" >&2
    exit 1
  fi
  # Escape characters that are special in a sed replacement.
  esc="${value//\\/\\\\}"
  esc="${esc//&/\\&}"
  esc="${esc//|/\\|}"
  sed -i.bak -E "s|^(.*= \")[^\"]*(\" // CONFIG:${key})\$|\1${esc}\2|" "$target"
done
rm -f "$target.bak"

echo "Updated $target:"
grep -n "CONFIG:" "$target" | sed -E 's/(SUPABASE_ANON_KEY.*"[A-Za-z0-9_-]{12})[^"]*/\1…/'
echo
echo "Next: cd $here && xtool dev run --usb"

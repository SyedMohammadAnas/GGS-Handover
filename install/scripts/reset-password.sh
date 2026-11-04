#!/usr/bin/env bash
# Sets a new password for any account (including the admin). There is no "forgot password"
# email on this system, so the person running the server uses this instead.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[[ -f .env ]] || { echo "No installation found (.env missing)."; exit 1; }

SERVICE_ROLE_KEY="$(grep -E '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)"

read -r -p "Account email: " email
[[ "$email" =~ ^[^@[:space:]]+@[^@[:space:]]+$ ]] || { echo "Not a valid email."; exit 1; }
read -r -s -p "New password (8+ characters): " pw; echo
read -r -s -p "Repeat: " pw2; echo
[[ "$pw" == "$pw2" ]] || { echo "Passwords did not match."; exit 1; }
[[ ${#pw} -ge 8 ]] || { echo "Password must be at least 8 characters."; exit 1; }

uid="$(docker compose exec -T db psql -U postgres -d postgres -Atq -v e="$email" \
  <<<'select id from auth.users where lower(email) = lower(:'"'"'e'"'"') limit 1;' | tr -d '\r')"
[[ -n "$uid" ]] || { echo "No account with that email."; exit 1; }

pw_json="${pw//\\/\\\\}"; pw_json="${pw_json//\"/\\\"}"
code="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "http://127.0.0.1:8000/auth/v1/admin/users/$uid" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -d "{\"password\":\"$pw_json\"}")"
unset pw pw2 pw_json

[[ "$code" == "200" ]] && echo "Password updated for $email." || { echo "Failed (HTTP $code)."; exit 1; }

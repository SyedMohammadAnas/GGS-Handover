#!/usr/bin/env bash
# Assist AR (GGS) installer.
#
#   ./install.sh            first-time install (asks questions, then starts everything)
#   ./install.sh --reset    DELETES the whole installation (database, uploaded models, .env)
#
# It asks for the admin username/password and the network mode BEFORE any container starts.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

API_SRC="${API_SRC:-..}"                  # repository root (contains backend/)
EXPERT_SRC="${EXPERT_SRC:-../expert-web}"  # the web console

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
die()  { printf '\n\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

compose() { docker compose "$@"; }
psql_db() { compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

# ---------------------------------------------------------------------------- reset
if [[ "${1:-}" == "--reset" ]]; then
  say "This permanently deletes the database, all uploaded 3D models and the saved settings."
  read -r -p "Type DELETE to continue: " answer
  [[ "$answer" == "DELETE" ]] || die "Cancelled."
  [[ -f .env ]] && compose down -v --remove-orphans || true
  rm -rf data .env config/Caddyfile config/livekit.yaml client-config.txt
  say "Removed. Run ./install.sh to install again."
  exit 0
fi

# ---------------------------------------------------------------------------- checks
command -v docker  >/dev/null || die "Docker is not installed. See HANDOVER.md, Part 2.1."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is missing. See HANDOVER.md, Part 2.1."
command -v openssl >/dev/null || die "openssl is not installed (sudo apt install openssl)."
command -v curl    >/dev/null || die "curl is not installed (sudo apt install curl)."

[[ -f "$API_SRC/backend/package.json" ]] \
  || die "Cannot find the API source (backend/) at $API_SRC. Run this from the install/ folder of the full GGS-Handover repository."
[[ -f "$EXPERT_SRC/Containerfile" ]] \
  || die "Cannot find the web console (expert-web/) at $EXPERT_SRC. Run this from the install/ folder of the full GGS-Handover repository."

if [[ -f .env ]]; then
  die "An installation already exists here (.env found). Re-running would change the passwords and break the database. To start over, run ./install.sh --reset"
fi

# ---------------------------------------------------------------------------- questions
say "Assist AR installer"
note "You will be asked four things. Nothing is started until you have answered all of them."

say "1) How will people reach this server?"
note "1 = Public domain with HTTPS (works from anywhere; needs a domain and open ports)"
note "2 = Local network only (testing at one site; no domain, no HTTPS)"
read -r -p "Choose 1 or 2: " MODE_CHOICE
case "$MODE_CHOICE" in
  1) MODE=domain ;;
  2) MODE=lan ;;
  *) die "Please run again and choose 1 or 2." ;;
esac

if [[ "$MODE" == "domain" ]]; then
  say "2) Your domain"
  note "Example: mycompany.com   (you will need DNS records for app, api, sb and lk under it)"
  read -r -p "Domain: " DOMAIN
  DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"
  [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "That does not look like a domain name."
else
  say "2) This server's address on your local network"
  guess="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
  [[ -n "$guess" ]] || guess="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  read -r -p "Server LAN IP [${guess:-192.168.1.10}]: " LAN_IP
  LAN_IP="${LAN_IP:-${guess:-192.168.1.10}}"
  [[ "$LAN_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "That does not look like an IP address."
fi

say "3) Admin username"
note "This is the email address you will use to sign in to the admin console."
read -r -p "Admin email: " ADMIN_EMAIL
[[ "$ADMIN_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "Please enter a valid email address."

say "4) Admin password"
note "At least 8 characters. It is not saved anywhere except inside the database (hashed)."
read -r -s -p "Admin password: " ADMIN_PASSWORD; echo
read -r -s -p "Repeat password: " ADMIN_PASSWORD2; echo
[[ "$ADMIN_PASSWORD" == "$ADMIN_PASSWORD2" ]] || die "The passwords did not match."
[[ ${#ADMIN_PASSWORD} -ge 8 ]] || die "The password must be at least 8 characters."
unset ADMIN_PASSWORD2

# ---------------------------------------------------------------------------- secrets
say "Generating secrets and configuration…"
rand() { openssl rand -hex "$1"; }
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
make_jwt() { # $1 = role
  local header payload now exp sig
  now="$(date +%s)"; exp=$(( now + 315360000 ))   # ten years
  header="$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)"
  payload="$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$now" "$exp" | b64url)"
  sig="$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)"
  printf '%s.%s.%s' "$header" "$payload" "$sig"
}

POSTGRES_PASSWORD="$(rand 24)"
JWT_SECRET="$(rand 32)"
ANON_KEY="$(make_jwt anon)"
SERVICE_ROLE_KEY="$(make_jwt service_role)"
LIVEKIT_API_KEY="API$(rand 6)"
LIVEKIT_API_SECRET="$(rand 32)"
DASHBOARD_KEY="$(rand 24)"

if [[ "$MODE" == "domain" ]]; then
  EXPERT_PUBLIC_URL="https://app.$DOMAIN"
  API_PUBLIC_URL="https://api.$DOMAIN"
  SUPABASE_PUBLIC_URL="https://sb.$DOMAIN"
  LIVEKIT_PUBLIC_URL="wss://lk.$DOMAIN"
  COMPOSE_FILE="docker-compose.yml:docker-compose.domain.yml"
  RTC_ADDRESS="  use_external_ip: true"
else
  EXPERT_PUBLIC_URL="http://$LAN_IP:3002"
  API_PUBLIC_URL="http://$LAN_IP:3000"
  SUPABASE_PUBLIC_URL="http://$LAN_IP:8000"
  LIVEKIT_PUBLIC_URL="ws://$LAN_IP:7880"
  COMPOSE_FILE="docker-compose.yml:docker-compose.lan.yml"
  RTC_ADDRESS="  use_external_ip: false
  node_ip: $LAN_IP"
fi

umask 077
cat > .env <<EOF
# Generated by install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Keep this file private; back it up.
# Do not commit it. Deleting or changing the secrets below breaks the existing database.
COMPOSE_FILE=$COMPOSE_FILE
API_SRC=$API_SRC
EXPERT_SRC=$EXPERT_SRC
MODE=$MODE

POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
LIVEKIT_API_KEY=$LIVEKIT_API_KEY
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET
DASHBOARD_KEY=$DASHBOARD_KEY

EXPERT_PUBLIC_URL=$EXPERT_PUBLIC_URL
API_PUBLIC_URL=$API_PUBLIC_URL
SUPABASE_PUBLIC_URL=$SUPABASE_PUBLIC_URL
LIVEKIT_PUBLIC_URL=$LIVEKIT_PUBLIC_URL
EOF
umask 022

tpl="$(cat config/livekit.yaml.template)"
tpl="${tpl//@RTC_ADDRESS@/$RTC_ADDRESS}"
tpl="${tpl//@LIVEKIT_API_KEY@/$LIVEKIT_API_KEY}"
tpl="${tpl//@LIVEKIT_API_SECRET@/$LIVEKIT_API_SECRET}"
printf '%s\n' "$tpl" > config/livekit.yaml
chmod 600 config/livekit.yaml

if [[ "$MODE" == "domain" ]]; then
  sed "s/@DOMAIN@/$DOMAIN/g" config/Caddyfile.template > config/Caddyfile
fi

mkdir -p data/db data/assets/models data/assets/thumbnails
[[ -f data/assets/models/manifest.json ]] || printf '{\n  "models": []\n}\n' > data/assets/models/manifest.json

# Values the iPhone app needs (all public; no passwords).
cat > client-config.txt <<EOF
SUPABASE_URL=$SUPABASE_PUBLIC_URL
SUPABASE_ANON_KEY=$ANON_KEY
API_URL=$API_PUBLIC_URL
LIVEKIT_URL=$LIVEKIT_PUBLIC_URL
EXPERT_URL=$EXPERT_PUBLIC_URL
EOF

# ---------------------------------------------------------------------------- start database + sign-in
say "Starting the database and sign-in service (first start can take a minute)…"
compose up -d db auth rest gateway

printf 'Waiting for sign-in service'
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:8000/auth/v1/health" >/dev/null 2>&1; then break; fi
  printf '.'; sleep 2
done
echo
curl -fsS "http://127.0.0.1:8000/auth/v1/health" >/dev/null 2>&1 \
  || die "The sign-in service did not start. Run: docker compose logs auth db"

printf 'Waiting for the sign-in tables'
for _ in $(seq 1 60); do
  have="$(psql_db -Atc "select to_regclass('auth.users') is not null" 2>/dev/null || true)"
  [[ "$have" == "t" ]] && break
  printf '.'; sleep 2
done
echo
[[ "${have:-}" == "t" ]] || die "The sign-in tables were not created. Run: docker compose logs auth"

say "Creating the application tables…"
psql_db -q < sql/schema.sql

# ---------------------------------------------------------------------------- admin account
say "Creating the admin account…"
pw_json="${ADMIN_PASSWORD//\\/\\\\}"; pw_json="${pw_json//\"/\\\"}"
em_json="${ADMIN_EMAIL//\\/\\\\}";   em_json="${em_json//\"/\\\"}"
code="$(curl -sS -o /tmp/ggs-admin-create.out -w '%{http_code}' \
  -X POST "http://127.0.0.1:8000/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$em_json\",\"password\":\"$pw_json\",\"email_confirm\":true}")" || true
unset ADMIN_PASSWORD pw_json
if [[ "$code" != "200" && "$code" != "201" ]]; then
  cat /tmp/ggs-admin-create.out >&2 || true; rm -f /tmp/ggs-admin-create.out
  die "Could not create the admin account (HTTP $code)."
fi
rm -f /tmp/ggs-admin-create.out

psql_db -q -v e="$ADMIN_EMAIL" <<'SQL'
UPDATE public.profiles SET role = 'admin' WHERE lower(email) = lower(:'e');
SQL
is_admin="$(psql_db -Atc "select count(*) from public.profiles where role = 'admin'")"
[[ "$is_admin" -ge 1 ]] || die "The admin account was created but could not be marked as admin."

# ---------------------------------------------------------------------------- everything else
say "Building and starting the API, web console and video server (first build takes several minutes)…"
compose up -d --build

printf 'Checking the API'
ok=""
for _ in $(seq 1 60); do
  if compose exec -T api wget -qO- http://localhost:3000/health >/dev/null 2>&1; then ok=1; break; fi
  printf '.'; sleep 2
done
echo
[[ -n "$ok" ]] || die "The API did not start. Run: docker compose logs api"

say "Done."
note "Expert / admin console : $EXPERT_PUBLIC_URL        (sign in as $ADMIN_EMAIL)"
note "Customer sign-up page  : $EXPERT_PUBLIC_URL/signup"
note "iPhone settings file   : $(pwd)/client-config.txt"
echo
note "Next: build the iPhone app — see HANDOVER.md, Part 5."
if [[ "$MODE" == "domain" ]]; then
  note "Make sure these DNS A records point to this server and ports 80, 443, 7881/tcp, 7882/udp are open:"
  note "  app.$DOMAIN  api.$DOMAIN  sb.$DOMAIN  lk.$DOMAIN"
else
  note "LAN mode: phones must be on the same Wi-Fi as this server. See HANDOVER.md, Part 4.2, for the microphone note."
fi

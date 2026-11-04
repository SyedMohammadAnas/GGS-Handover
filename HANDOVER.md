# Assist AR (GGS) — Handover and Installation Guide

This guide takes a new client from "empty server" to "working system": a web console for
the admin and experts, a customer app on iPhones, and live video with 3D annotations
between them. Everything runs on **your own server**. There is no Google account, no
cloud service and no subscription involved.

> **How to read this guide.** Part 1 explains what the system is, in plain language. Parts 2–7
> are the steps, in order. Part 8 is for when something goes wrong. Commands are shown in
> grey boxes; type or paste them exactly. Words in `<angle brackets>` are for you to fill in.

---

## Part 1 — What you are getting

**Three kinds of people use the system:**

| Who | What they do | Where |
|-----|--------------|-------|
| **Admin** | Creates expert accounts, uploads 3D models, manages users | Web console (`/admin`) |
| **Expert** | Joins a customer's session, watches their camera, draws arrows and places 3D models in the customer's view | Web console |
| **Customer** | Opens the app, shares their 11-digit ID, shows their surroundings through the camera | **Instant** iPhone app |

**Accounts**

- The admin account is created **during installation**: you choose its username (an email
  address) and password. Nobody else knows them.
- Anyone who signs up on their own — in the iPhone app or on the web `/signup` page — is
  automatically a **customer**. This cannot be changed from the customer's side.
- Only the admin can create experts (Admin page → "Create an expert account").
- There is **no "forgot password" email** (the system sends no email). Whoever runs the server
  resets passwords with `./scripts/reset-password.sh` (Part 7).

**The parts, in one picture**

```
 iPhone app (customer) ──┐                    ┌── Web console (admin / experts)
                         │                    │
                 sign-in + data  ·  sessions + 3D models  ·  live video
                         │                    │
        ┌────────────────┴────────────────────┴────────────────┐
        │   YOUR SERVER (Docker)                                │
        │   database · sign-in · API · web console · LiveKit    │
        └───────────────────────────────────────────────────────┘
```

**What is in this repository**

| Folder | What it is |
|--------|------------|
| `install/` | The installer, Docker setup, database tables and security rules, helper scripts |
| `ios-app/` | The **Instant** customer iPhone app (the supported mobile app) |
| `backend/` | The API: customer sessions and 3D model storage |
| `expert-web/` | The web console for the admin and experts |
| `android-app/` | Android version of the customer app — **reference only, not supported yet** |
| `scripts/` | Helper to convert 3D models to USDZ |
| this folder | `START-HERE.md`, `HANDOVER.md` (this guide), `DOCUMENTATION-INDEX.md` |

---

## Part 2 — Before you start

### 2.1 The server

| Need | Minimum | Notes |
|------|---------|-------|
| Operating system | Ubuntu 22.04 or 24.04 (64-bit) | Other Linux works if Docker works |
| Memory | 4 GB (8 GB is more comfortable) | The first install compiles the web console |
| Disk | 20 GB free | Grows with uploaded 3D models |
| Network | Fixed address | A public IP for domain mode; a fixed LAN IP for LAN mode |

Install Docker once:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# log out and back in so the group change applies, then check:
docker compose version
```

Also needed: `git`, `curl`, `openssl` (`sudo apt install git curl openssl`).

### 2.2 Choose how people will connect

You can run in either mode. The installer asks which one.

| | **Domain mode** (production) | **LAN mode** (testing at one site) |
|---|---|---|
| Works from | Anywhere on the internet | Devices on the same Wi-Fi/network |
| Needs | A domain name you control and public ports | Only the server's local IP |
| Security | HTTPS, automatic certificates | Plain HTTP (not private on shared networks) |
| Expert microphone | Works | Needs a workaround (see Part 4.2) |

### 2.3 For domain mode — DNS

At your domain provider, create **four "A" records** pointing to the server's **public IP**:

```
app.<your-domain>    →  <server public IP>      web console
api.<your-domain>    →  <server public IP>      API and 3D model files
sb.<your-domain>     →  <server public IP>      sign-in and database gateway
lk.<your-domain>     →  <server public IP>      live video signalling
```

Wait until they resolve (`ping app.<your-domain>` shows your IP) before installing, or
certificates cannot be issued.

### 2.4 For the iPhone app

- A computer to build the app (Linux, macOS, or Windows with WSL2) and a USB cable.
- A **free Apple ID** (no paid developer account needed).
- An iPhone running iOS 17 or later.
- The `Xcode_*.xip` file from Apple's developer downloads site (xtool extracts the iOS
  SDK from it; you do not need a Mac or to install Xcode).

---

## Part 3 — Install the server

### Step 1 — Get the repository onto the server

Everything is in one repository, `GGS-Handover`. Put it on the server in either of two ways:

```bash
# A) from your Git hosting (repository address supplied by your contact)
git clone <repository-url> GGS-Handover
cd GGS-Handover

# B) from the archive you were sent
tar -xzf GGS-Handover.tar.gz
cd GGS-Handover
```

Keep the repository whole: the installer builds the API (`backend/`) and the web console
(`expert-web/`) from the folders next to `install/`.

### Step 2 — Open the ports (firewall)

**Domain mode:**

```bash
sudo ufw allow 22/tcp       # keep your own SSH access!
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7881/tcp     # live video (media)
sudo ufw allow 7882/udp     # live video (media)
sudo ufw enable
```

If the server is behind a router, also **forward** those same ports on the router to the server.

**LAN mode:**

```bash
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 3002/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 7882/udp
sudo ufw enable
```

### Step 3 — Run the installer

```bash
cd install
./install.sh
```

It asks four questions **before it starts anything**:

1. **Mode** — `1` domain or `2` local network.
2. **Domain** (or the server's local IP).
3. **Admin username** — an email address, e.g. `admin@yourcompany.com`.
4. **Admin password** — at least 8 characters, typed twice.

Then it creates all keys and passwords for you, starts the database, creates the tables and
the admin account, and builds and starts everything. **The first run takes 5–15 minutes**
(it builds the web console). When it prints `Done.` you will see your addresses.

It produces two files you must understand:

| File | What it holds | What to do |
|------|---------------|------------|
| `.env` | Every generated secret for this server | **Back it up, keep it private, never share or commit it.** Losing it makes backups unusable |
| `client-config.txt` | The five public addresses/keys the iPhone app needs | Used in Part 5 |

The admin password is **not** stored in either file.

### Step 4 — Check it works

```bash
./scripts/status.sh
```

Every line under "Health" should say `OK`. Then open the web console address printed by the
installer, sign in with the admin username and password you chose.

> **Not yet verified end to end.** The installer, compose files and app code were written and
> statically checked (configuration parses, scripts pass a syntax check, the web console and API
> type-check, the iPhone app compiles). A full install on a clean server has **not** been run. The
> first install should be done together with the person who handed this over, and Part 8 lists
> the most likely snags.

---

## Part 4 — Networking details

### 4.1 Ports

| Port | Protocol | Mode | Used for |
|------|----------|------|----------|
| 80, 443 | TCP | Domain | Web, API, sign-in, video signalling (via HTTPS) |
| 7881 | TCP | Both | Live video media (fallback path) |
| 7882 | UDP | Both | Live video media (main path) |
| 3002 | TCP | LAN | Web console |
| 3000 | TCP | LAN | API / 3D model files |
| 8000 | TCP | LAN | Sign-in and database gateway |
| 7880 | TCP | LAN | Live video signalling |

Closed ports for **media** (7881/7882) are the most common reason a call "connects" but shows
no video. Check them first.

### 4.2 LAN mode limits

- Phones and the expert's computer must be on the **same network** as the server.
- Web browsers only allow microphone/camera access on **HTTPS pages** — or on the server
  machine itself (`http://localhost:3002`). On other computers over plain HTTP the expert can
  **see and hear the customer but cannot speak**. Workarounds: open the console from the
  server computer; or in Chrome open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
  add the console address, enable, restart; or use domain mode.
- iPhones ask for **Local Network** permission the first time — tap **Allow**.

### 4.3 Domain mode on the same network as the server

If phones and server share a Wi-Fi network and some routers refuse to loop back to their own
public address, first test from **mobile data**, or ask your network person to set a local DNS
entry for the four names pointing at the server's LAN IP.

---

## Part 5 — Build and install the iPhone app

The app is built and installed with **xtool**, which works without Xcode. Follow xtool's own
installation guide for your computer (https://xtool.sh/documentation/xtooldocs/) to:
install the Swift toolchain, run the SDK setup with your `Xcode_*.xip`, and log in with your free
Apple ID. You also need the `ios-app/` folder on **the computer you build from** (clone or
copy the repository there), and the file `client-config.txt` that the installer created on the
**server** (inside `install/`). Copy that one file to the build computer — it holds only public
addresses and a public key, no passwords. Then:

```bash
cd ios-app

# 1. Point the app at YOUR server (fills in ServerConfig.swift from the installer's file)
./scripts/configure-server.sh /path/to/client-config.txt

# 2. Plug in the iPhone (unlocked, tap "Trust") and build + install
xtool dev run --usb
```

On the phone, the first time: **Settings → General → VPN & Device Management → your Apple ID →
Trust**, then open **Instant**.

**Things to know**

- **Free Apple ID limits:** an app signed with a free Apple ID **stops opening after 7 days** —
  run `xtool dev run --usb` again to renew it. A free account can have only **3 such apps** on a
  phone at once.
- **"Bundle ID not available":** change `bundleID` in `ios-app/xtool.yml` to something unique to
  you (for example `com.yourcompany.instant`) and run again.
- **Each phone needs this install** (one build per phone, with that phone connected).
- **First build downloads about 690 MB** (the video library). On a slow connection it can time
  out. Download it once with a resumable command, then run the build again:
  ```bash
  mkdir -p ~/.cache/org.swift.swiftpm/artifacts
  curl -L -C - --retry 50 --retry-all-errors \
    -o ~/.cache/org.swift.swiftpm/artifacts/https___github_com_livekit_webrtc_xcframework_releases_download_150_7871_04_LiveKitWebRTC_xcframework_zip \
    https://github.com/livekit/webrtc-xcframework/releases/download/150.7871.04/LiveKitWebRTC.xcframework.zip
  ```
- **Run xtool in a normal terminal window** (it needs an interactive terminal).
- **Apple sign-in problems:** in October 2026 Apple changed something that broke the stock
  xtool login on some versions (error `-80045`). If login fails, check xtool's issue tracker for
  the current fix before trying repeatedly.
- The Xcode project file in `ios-app/` is **not maintained**; use xtool.
- The repository includes a patched copy of the LiveKit library in `ios-app/Vendor/`. Do not replace
  it with the upstream version: the upstream build crashes when launched through xtool.
- **Android:** `android-app/` is included as **reference source only**. It signs in with Google,
  which this server does not use, so it will not work until its sign-in is replaced (see
  `android-app/README.md`). The iPhone app is the supported customer app.

---

## Part 6 — First-run checklist

Do these in order after installing. If a step fails, go to Part 8.

1. [ ] Open the web console, sign in as the admin.
2. [ ] **Admin → Create an expert account** — make one test expert; sign out and sign in as them.
3. [ ] **Admin → 3D models** — upload a small `.usdz` file; it should appear in the list.
4. [ ] On an iPhone, open **Instant → Create an account** (new email + password ≥ 8 characters).
5. [ ] The app's home screen shows an **11-digit ID**.
6. [ ] On the web console (as the expert), enter that ID and click **Connect**.
7. [ ] The phone shows "expert is joining", then the camera view; the expert sees the phone's camera.
8. [ ] Expert places a 3D model or draws an arrow — it appears on the phone.

3D models must be **USDZ** (Apple's AR format). Other formats such as GLB will not display.

---

## Part 7 — Everyday operation

All commands run on the server, inside the `install/` folder of the repository.

| Task | Command |
|------|---------|
| See if everything is healthy | `./scripts/status.sh` |
| Restart everything | `docker compose restart` |
| Stop / start | `docker compose stop` · `docker compose up -d` |
| Read a log | `docker compose logs --tail 100 <name>` — names: `db auth rest gateway api expert livekit caddy` |
| Back up (database + uploaded models) | `./scripts/backup.sh` — copy `backups/` **and `.env`** off the server |
| Reset someone's password (also the admin) | `./scripts/reset-password.sh` |
| Add an expert | Admin page in the web console |
| Update to new code | `git pull` in the repository, then `docker compose up -d --build` (in `install/`) |
| **Wipe everything and start over** | `./install.sh --reset` (asks you to type DELETE) |

**Restore from a backup** (outline): reinstall on a clean server, replace the generated `.env`
with the backed-up `env.backup`, start only the database
(`docker compose up -d db`), load `database.sql` with
`docker compose exec -T db psql -U postgres -d postgres < backups/<stamp>/database.sql`,
unpack `assets.tar.gz` into `data/`, then `docker compose up -d`.

---

## Part 8 — Troubleshooting

| What you see | Likely cause | What to do |
|--------------|--------------|------------|
| `install.sh` stops: "Cannot find the API source" | The three folders are not side by side | Put them in one folder as in Part 3, Step 1 |
| `install.sh` stops: "sign-in service did not start" | Database not ready or crashed | `docker compose logs auth db` |
| Certificates fail / browser says "not secure" (domain mode) | DNS not pointing at the server yet, or ports 80/443 closed | Check the four DNS records; open ports; `docker compose logs caddy` |
| Web console loads but sign-in says wrong password | Typo, or you are using the wrong username | Username is the **email**. Reset with `./scripts/reset-password.sh` |
| Sign-in loops back to the login page | The account is a customer, not an expert | Admin creates/promotes the account |
| Call "connects" but no video, or drops after ~15 s | Media ports blocked | Open 7881/tcp and 7882/udp on the firewall **and router** |
| Expert can't speak (LAN mode) | Browsers block the mic on plain HTTP | See Part 4.2 |
| Phone says it can't reach the server | Wrong address in the app, or phone on a different network | Re-run `configure-server.sh` and reinstall; in LAN mode, same Wi-Fi |
| "Session not found" when connecting | ID typed wrongly, or the customer isn't on the app home screen | Re-check the 11 digits; keep the app open |
| App stops opening after a week | Free Apple ID expiry | Reinstall with `xtool dev run --usb` |
| 3D model upload fails | File isn't `.usdz`, or larger than 50 MB | Convert to USDZ; reduce the size |
| Uploads fail with "DASHBOARD_KEY…" | `.env` damaged | Compare with `.env` backup; `docker compose up -d` after fixing |

Still stuck? Collect `./scripts/status.sh` output and `docker compose logs --tail 200` for the
failing service and send them to your support contact. **Do not send `.env`.**

---

## Part 9 — Security notes

- `.env` holds the database password, the signing key and the service key. Treat it like a bank
  password. It is excluded from Git on purpose.
- The anon key inside the iPhone app is **public by design**; it only allows what the database
  rules allow. The service key never leaves the server.
- Customers cannot make themselves experts or admins: the database blocks changing the role from
  a signed-in session, and every sign-up starts as customer.
- Keep the server's system updates on (`sudo apt update && sudo apt upgrade`), and keep the
  firewall enabled.
- LAN mode uses plain HTTP. Do not use it for real customer data on a shared network.
- **Code history:** this package is a single clean snapshot with no earlier history. If you put
  it into your own Git hosting, keep your repositories private.
- Live video runs on the LiveKit server inside your own installation; video is not sent to any
  third-party video service.

---

## Appendix A — What the installer wrote into `.env`

| Setting | Meaning |
|---------|---------|
| `MODE` | `domain` or `lan` |
| `POSTGRES_PASSWORD` | Database password (generated) |
| `JWT_SECRET` | Signing secret for sign-in tokens (generated) |
| `ANON_KEY` / `SERVICE_ROLE_KEY` | Public / server-only database keys (derived from the secret) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Live video credentials (generated) |
| `DASHBOARD_KEY` | Shared secret between the web console and API for 3D model uploads |
| `EXPERT_PUBLIC_URL`, `API_PUBLIC_URL`, `SUPABASE_PUBLIC_URL`, `LIVEKIT_PUBLIC_URL` | The four public addresses |

## Appendix B — Files in this repository

| Path | Purpose |
|------|---------|
| `install/install.sh` | The installer (asks the questions, generates secrets, starts everything) |
| `install/docker-compose.yml` | The services |
| `install/docker-compose.domain.yml` / `docker-compose.lan.yml` | Mode-specific additions (selected for you) |
| `install/config/` | Templates the installer fills in (gateway, HTTPS, live video) |
| `install/sql/` | Database setup (`schema.sql` holds the tables and the security rules) |
| `install/scripts/status.sh`, `backup.sh`, `reset-password.sh` | Operation helpers |
| `ios-app/` | The iPhone app (`GGSApple/Config/ServerConfig.swift` holds the server addresses) |
| `backend/` | The API (Node/Express) |
| `expert-web/` | The web console (Next.js) |
| `android-app/` | Android app, reference only (see its `README.md`) |
| `scripts/glb_to_usdz.py` | Converts a 3D model to USDZ |

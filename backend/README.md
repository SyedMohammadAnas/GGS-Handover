# API (Node / Express)

Customer sessions, live-video tokens and 3D model storage. Started and configured by
`install/install.sh`; see `HANDOVER.md` at the repository root.

## Settings (environment variables)

| Variable | Needed | Meaning |
|----------|--------|---------|
| `SUPABASE_URL` | Yes | Address of the sign-in/database gateway the API talks to |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only database key |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Yes | Live-video credentials |
| `PUBLIC_API_URL` | Yes | The API's public address (used in 3D model download links) |
| `DASHBOARD_KEY` | For models | Shared secret with the web console; model upload/list/delete return HTTP 503 until it is set |
| `PORT` | No | Defaults to 3000 |

There are **no built-in default keys**: the API refuses to start without the required settings.

## 3D models

Uploaded `.usdz` files are stored under `assets/models/` (the installer mounts a persistent
folder there). The admin uploads them from the web console; they then appear for experts and in
the iPhone app.

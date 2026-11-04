# GGS Assist AR — handover repository

Self-hosted Assist AR: a customer iPhone app, an expert/admin web console, an API and live video,
all running on your own server. No Google account or cloud service is needed.

**Start with [`START-HERE.md`](START-HERE.md)**, then [`HANDOVER.md`](HANDOVER.md).
[`DOCUMENTATION-INDEX.md`](DOCUMENTATION-INDEX.md) lists every folder and document.

| Folder | What it is |
|--------|------------|
| `install/` | Installer, Docker setup, database rules, helper scripts |
| `ios-app/` | **Instant** customer iPhone app (supported) |
| `backend/` | API: sessions and 3D model storage |
| `expert-web/` | Web console for the admin and experts |
| `android-app/` | Android app — reference only, not supported yet |
| `scripts/` | 3D model conversion helper |

In short, on the server:

```bash
cd install
./install.sh
```

# Assist AR expert web (GGS handover)

Next.js 15 web console for Assist AR.

- **Admin / experts** sign in with an email (username) and password and join customer
  sessions by the customer's 11-digit ID.
- **Customers** create an account at `/signup` and use the **Instant** iPhone app. Every
  self-registered account is a customer.
- **Admin** (`/admin`) creates expert accounts, changes roles, and uploads or deletes
  `.usdz` 3D models for the AR view.

This branch (`GGS-Handover`) has no Google sign-in and no hosted-service dependencies.
This folder is one part of the GGS handover repository. Install the whole stack with
`install/install.sh`; the guide is `HANDOVER.md` at the repository root.

## Configuration

All settings are environment variables; see `.env.example`. `NEXT_PUBLIC_*` values are
baked in at build time (the install repo passes them as Docker build arguments), so
rebuild the image after changing them.

## Develop locally

```bash
cp .env.example .env.local   # fill in values from your install
npm ci
npm run dev                  # http://localhost:3002 depends on your PORT setting
```

## Container image

`Containerfile` builds a standalone Next.js server on port 3002.

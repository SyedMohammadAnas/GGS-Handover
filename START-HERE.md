# Assist AR (GGS) — Start here

Welcome. This repository lets you run **Assist AR** on your own server: customers use an
iPhone app to show their surroundings, and your experts see the camera live in a web console and
guide them with arrows and 3D models.

## What is in this repository

```
GGS-Handover/
├── START-HERE.md          ← you are here
├── HANDOVER.md            ← the full guide (read this next)
├── DOCUMENTATION-INDEX.md ← every folder and document, explained
├── install/               ← the installer and server setup
├── ios-app/               ← the Instant iPhone app (supported)
├── backend/               ← the API
├── expert-web/            ← the web console for the admin and experts
├── android-app/           ← Android app (reference only, not supported yet)
└── scripts/               ← 3D model conversion helper
```

Everything is plain files. There is nothing secret inside: all passwords and keys are
created fresh on **your** server when you install, and no Google account or cloud
subscription is needed.

## What you need

| | |
|---|---|
| **A server** | Ubuntu 22.04/24.04, 4 GB memory (8 GB better), 20 GB disk |
| **Either** | a domain name you control (for use from anywhere), **or** just a local network (for testing at one site) |
| **For the iPhones** | a computer to build with, a USB cable, and a free Apple ID per person who installs |
| **Time** | About 1–2 hours for the first install, mostly waiting for builds |

## The five steps

1. **Read** `HANDOVER.md` — Parts 1 and 2 (about 10 minutes).
2. **Prepare** the server and, for a domain, the four DNS records (Part 2).
3. **Install** the server: put this repository on it and run `./install.sh` inside `install/`
   (Part 3). It asks for your **admin username and password**, then does the rest.
4. **Open the ports** on the firewall/router (Part 4).
5. **Install the iPhone app** on each phone (Part 5), then follow the **first-run checklist**
   (Part 6) to confirm everything works end to end.

## Where to find things

| I want to… | Open |
|------------|------|
| Understand what the system is | `HANDOVER.md`, Part 1 |
| Install the server | `HANDOVER.md`, Part 3 |
| Put the app on an iPhone | `HANDOVER.md`, Part 5 |
| Back up, reset a password, update | `HANDOVER.md`, Part 7 |
| Fix a problem | `HANDOVER.md`, Part 8 |
| See what every document and folder is | `DOCUMENTATION-INDEX.md` |

## Good to know before you begin

- **Admin and customers.** You choose the admin login during installation. Anyone who signs up
  on their own is a customer; only the admin creates experts and uploads 3D models.
- **Free Apple ID.** An app installed with a free Apple ID stops opening after **7 days** and is
  renewed by installing again. A free account can hold **3** such apps per phone.
- **3D models** must be in **USDZ** format.
- **Android** is included as reference source only; the iPhone app is the supported customer app.
- **The first install is best done together** with your contact, at least once, to confirm the
  setup on your own server.

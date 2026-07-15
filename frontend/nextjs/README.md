# frontend/nextjs — A.C.E OS Next.js (App Router) port

Alternative A.C.E OS front-end written in **Next.js 15 (App Router) +
React 18**. It serves a single page that connects to the existing
Express backend (`@ace/backend`) over HTTP.

This is one of six port shells. The others are:

| Stack     | Path                    |
|-----------|-------------------------|
| Next.js   | `frontend/nextjs/`      |
| Rust+Iced | `frontend/rust-iced/`   |
| Rust+Slint| `frontend/rust-slint/`  |
| C++ Qt    | `frontend/cpp-qt/`      |
| JavaFX    | `frontend/java-javafx/` |
| C GTK4    | `frontend/c-gtk4/`      |

## Why Next.js

* Same TypeScript + React knowledge as the existing `@ace/desktop-shell`.
* App Router lets server components pre-render the first paint, which
  speeds up the Pi kiosk experience without changing the backend.
* Same `/api/*` rewrite trick works in dev and production.

## Prerequisites

* Node.js 18+ (whichever version the project's other npm workspaces
  target; the root has `>=18.0.0`).
* The A.C.E backend must be running on `http://localhost:4318` or the
  proxy target in `next.config.mjs` updated.

## Run

```bash
cd frontend/nextjs
npm install
npm run dev          # opens http://localhost:3000
```

Production:

```bash
npm run build
npm run start        # serves on :3000
```

## What the MVP shows

A single card with three pieces of state:

* `Backend:` populated from `GET /api/health`
* `User:` populated from `GET /api/users/me`
* `Last fetched:` timestamp updated on every Refresh

A Refresh button re-fires both calls. If the backend is offline the
page surfaces `Error: <status>` instead of crashing.

## Files of interest

```
frontend/nextjs/
├── package.json           # Next 15 + React 18
├── next.config.mjs        # /api/* → backend :4318 rewrite
├── tsconfig.json          # strict mode, bundler resolution
├── app/
│   ├── layout.tsx         # root <html>/<body>
│   └── page.tsx           # the dashboard (Client Component)
└── README.md
```

## Notes / pitfalls

* The `/api/*` rewrite works with POSTs and JSON bodies too — the AI
  Tutor's `POST /api/ai/messages` body is forwarded transparently.
* If you change the backend port, update `next.config.mjs`.
* `next-env.d.ts` is auto-generated on first `next dev` — don't edit
  it (the comment inside the file says so).

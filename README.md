# A.C.E OS - Academic Companion Engine OS

A lightweight Linux-based operating system for Raspberry Pi, designed specifically for students. A.C.E OS combines a minimal Linux base with a custom React + TypeScript desktop environment to deliver a complete educational computing experience.

## Architecture

A.C.E OS is built as a tiered system:

```
┌─────────────────────────────────────────────────┐
│         A.C.E React Desktop Environment         │
│  (Apps, UI, Productivity, AI Features)          │
├─────────────────────────────────────────────────┤
│      A.C.E Backend API (Node.js + SQLite)       │
│  (Tasks, Calendar, Settings, Hardware)         │
├─────────────────────────────────────────────────┤
│   A.C.E Hardware Services (Linux Daemons)       │
│  (Camera, GPIO, AI, Sync)                       │
├─────────────────────────────────────────────────┤
│   Linux Base (Raspberry Pi OS Lite ARM64)       │
│  (Drivers, Networking, Storage)                │
└─────────────────────────────────────────────────┘
```

## Project Structure

```
ace-os/
├── frontend/        React + TypeScript desktop & apps
│   ├── desktop-shell/   Main A.C.E interface
│   ├── apps/            Individual applications
│   │   ├── home/        Dashboard
│   │   ├── planner/     Calendar & scheduling
│   │   ├── tasks/       Task management
│   │   ├── subjects/    Learning subjects
│   │   ├── focus/       Pomodoro & study sessions
│   │   ├── ai/          AI learning assistant
│   │   ├── statistics/  Learning analytics
│   │   └── settings/    System configuration
│   └── shared/          Shared types & utilities
├── backend/         Node.js + TypeScript API
│   ├── api/             REST endpoints
│   ├── database/        SQLite layer
│   └── services/        Business logic
├── system/          Linux system configuration
│   ├── linux-config/    OS setup scripts
│   ├── services/        Systemd unit files
│   └── boot/            Boot configuration
└── hardware/        Hardware service code
    ├── camera/          Camera interface
    ├── sensors/         Sensor interfaces
    └── gpio/            GPIO control
```

## Quick Start (Development)

### Prerequisites
- Node.js >= 18
- npm >= 9

### Install
```bash
npm install
```

### Run Development Mode
```bash
# Start backend (terminal 1)
npm run dev:backend

# Start desktop shell (terminal 2)
npm run dev:shell
```

The desktop shell will open at `http://localhost:5173` in Chromium kiosk mode.

### Build for Production
```bash
npm run build
```

## Backend

The backend is a **Node.js 18+ / Express 4 / SQLite (WAL) / TypeScript** service that owns all of A.C.E OS's persistent state. It runs on port **4318** by default (4317 is reserved for the Vite dev server, so the two run side by side via `npm run dev`). Set `ACE_PORT=4317` for production where one process serves both the API and the built React shell.

### Run

```bash
# From project root — dev mode (auto-reload on file change)
npm run dev:backend          # → http://localhost:4318

# Or directly from the backend workspace
cd backend && npm run dev

# Run the test + typecheck suite
cd backend && npm test       # 16/16 passing
cd backend && npm run typecheck
```

### Configuration (env vars)

| Var | Default | Purpose |
|---|---|---|
| `ACE_PORT` | `4318` | HTTP listen port. Use `4317` in production to also serve the built shell. |
| `ACE_DB_PATH` | `./data/ace.db` | SQLite file path. Parent dirs are created on first boot. |
| `ACE_AUTO_INSTALL_OLLAMA` | unset | Set to `1` to kick off the Ollama installer in the background at boot. |

### Data

A single SQLite file (WAL mode) is created on first boot and auto-seeded with the default student, subjects, tasks, and calendar events sourced from `@ace/shared`. Schema is created idempotently via `CREATE TABLE IF NOT EXISTS` — safe to ship as a fresh image.

| Table | What it stores |
|---|---|
| `users` | Singleton student profile + preferences (theme, accent, font scale) |
| `subjects` | Subjects with target hours / week and progress |
| `tasks` | Tasks with priority, due date, category, subject link, completion |
| `events` | Calendar events (classes, exams, assignments) |
| `notes` | Subject-scoped notes with tags and a revision counter |
| `sessions` | Pomodoro / focus sessions with duration and completion |
| `messages` | AI tutor chat history (capped at 200 most recent on read) |
| `notifications` | System + app notifications (read/unread) |
| `settings_kv` | Free-form key/value store for Settings UI slices |

### REST API

All routes return JSON. Mutation requests take a camelCase body matching the `@ace/shared` types. The backend uses a snake_case schema internally; mappers in `db.ts` translate both ways.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness probe (`{ok,service,ts}`) |
| `GET` / `PATCH` | `/api/users/me` | Singleton student profile (auto-creates the default on first access) |
| `GET` / `POST` | `/api/tasks` | List / create tasks |
| `PATCH` / `DELETE` | `/api/tasks/:id` | Update / delete a task (PATCH auto-stamps `completedAt`) |
| `GET` / `POST` | `/api/subjects` | List / create subjects |
| `PATCH` / `DELETE` | `/api/subjects/:id` | Update / delete a subject |
| `GET` / `POST` | `/api/calendar` | List / create calendar events (ISO timestamps required) |
| `PATCH` / `DELETE` | `/api/calendar/:id` | Update / delete an event |
| `GET` / `POST` | `/api/notes` | List / create notes (optional `?subjectId=` filter) |
| `PATCH` | `/api/notes/:id` | Update a note (auto-bumps `revisionCount` when body changes) |
| `GET` / `POST` | `/api/focus` | List / create focus sessions (capped at 200) |
| `PATCH` | `/api/focus/:id` | Update a focus session |
| `GET` / `POST` | `/api/notifications` | List / push notifications (capped at 100) |
| `PATCH` | `/api/notifications/:id` | Mark read/unread |
| `GET` / `PUT` | `/api/settings` | Free-form key/value settings (per-key rows) |
| `GET` | `/api/hardware/device` | Live device snapshot (hostname, CPU temp, memory, IP, kernel, uptime) — refreshed every 5s |
| `GET` | `/api/hardware/leds` | Recent LED intents (debug helper) |
| `POST` | `/api/hardware/led` | Toggle a GPIO LED (`{pin: 0..40, on: bool}`) |
| `POST` | `/api/system/shutdown` | Power off the device (stub on non-Pi dev hosts) |
| `POST` | `/api/system/restart` | Reboot the device (stub on non-Pi dev hosts) |
| `GET` | `/api/ai/messages` | Last 200 chat messages |
| `POST` | `/api/ai/messages` | Send a prompt to the AI tutor (persists user + assistant turns) |
| `POST` | `/api/ai/vision` | Describe an image (camera input) |
| `POST` | `/api/ai/reset` | Clear chat history |
| `GET` | `/api/ai/status` | Ollama / model readiness for the install CTA |
| `POST` | `/api/ai/install` | Manually trigger the Ollama installer in the background |

Unknown `/api/*` paths return `404 {error:"not_found"}` (JSON) — not an HTML index, even when the production shell is mounted.

### Verified working (live)

- `npm run typecheck` — passes
- `npm test` — 16/16 tests pass
- Boots and binds to `:4318`; live smoke tests hit all 13 GET routes (200) plus POST `/api/tasks`, POST `/api/focus`, PUT `/api/settings`, POST `/api/hardware/led` (all 201/200 with expected JSON)

## Raspberry Pi Deployment

See [`system/linux-config/INSTALL.md`](system/linux-config/INSTALL.md) for full deployment instructions to Raspberry Pi hardware.

## Applications

1. **Dashboard** — Today's overview (greeting, stats, schedule, subjects, up next, app launcher, recent activity)
2. **Home** — Full-screen daily summary (today's events, open tasks, subject progress, "up next")
3. **AI Tutor** — Conversational study helper (Ollama/llama.cpp)
4. **Focus** — Pomodoro timer with break tracking and session history
5. **Settings** — Theme, wallpaper, profile, network, device, system

> Tasks, Subjects, Planner and Statistics are parked in `later/apps/` and can be re-enabled by moving the directory back and adding a manifest to `frontend/shared/src/apps-registry.ts` — see `later/README.md` for the procedure.

## Hardware Services

- **ace-core**: Main OS service & IPC
- **ace-hardware**: Camera, GPIO, sensors, LEDs
- **ace-ai**: Local AI processing
- **ace-sync**: Data backup & syncing

## C components (`os/lib/`)

Pure C libraries that own the on-Pi logic. Each ships with a standalone test driver and a Makefile so it builds and verifies without the rest of the toolchain.

| Library | Path | Purpose |
|---|---|---|
| `libfocus` | `os/lib/focus/` | Focus timer state machine (work → break → done). 100% dependency-free; can link into a future native Pi daemon. |

Build + test:

```bash
cd os/lib/focus
make         # builds libfocus.a + test_focus
make test    # runs the standalone test driver
make clean
```

## License

MIT

## dev log |

v1 was pushed at  (15 July 2026 at 15:42)
   initail com is still v1 with json files beng the main change 
Update: v1.01 -- beta was a debug due to an old code file 
Update: v1.01.1 --beta adds files for the raspberry py to control gpio camara sensors ect..
  Note: not being pushed due to bugs
  Note: more erros found in /home/Lihan/A.C.E/frontend/apps/ai/tsconfig.json
  Note: error is [{
	"resource": "/home/Lihan/A.C.E/frontend/apps/ai/tsconfig.json",
	"owner": "typescript",
	"severity": 8,
	"message": "Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '\"ignoreDeprecations\": \"6.0\"' to silence this error.\n  Visit https://aka.ms/ts6 for migration information.",
	"source": "ts",
	"startLineNumber": 3,
	"startColumn": 3,
	"endLineNumber": 3,
	"endColumn": 20,
	"origin": "extHost1"
}]
Note: cant find main error Timestamp Jul15 at 1618 hr 
Note: sorry for using military time as im a cadet and im use to that [nzcf website fpr refrece to cadets](https://cadetforces.org.nz/)

Note: Error found in the ai app folder api error and due to taht no important till later on timestamp 1622 hr
Update: adding settings app and finish codeing gui ran by npm run dev time stamp 1623hr 
Note: 2nd error but not for this project idk how that code got into my codebase timestamp jul 15 1629hr
Update:adding backround folder ato add more background timestamp jul 15 1717 hr
Update: 4 errors ![screenshot](image.png) timestame jul15 17:23
Note using claude for debugging 
Update pushing v1.2.0 --beta with kind of working gui
   Note: this will be the 4th push for this project 
   Note; 5 errors 
Update: timestamp jul 15 1733 hr claude code found the erros but just makeing them worst somehow 
   Note this is what claude code said # Developer Notes #2: Major Errors and Debugging Challenges

During the latest stage of development, I encountered two major errors that have become significant blockers. After spending time investigating the issues, testing possible solutions, and reviewing the code, I have not yet been able to determine the exact cause.

These errors have slowed development progress, but they have also provided useful opportunities to learn more about the system and identify areas that may need improvement. Debugging complex problems is a normal part of software development, even if it sometimes feels like the code has decided to fight back for no logical reason.

At this stage, I may use additional debugging tools, including Claude Code, to help analyse the issues and speed up the troubleshooting process. The goal is not just to find a quick fix, but to understand the underlying cause and make sure the solution is reliable.

Further updates will be added once more information is discovered, including the root cause of the errors, the debugging process, and the final fixes implemented.
Update:
       New push no version update comminted claude code fixis
                                                             Timestamp: jul 1510 hrs  
Update: version 1.2.1 --beta is now being pushed timespame jul 15 1829hr                                                              
Update v1.2.1--beta is a broken vertion not to be used 
update v1.2.2 -- beta is a fix hopefull that is now being pushed 
  Note: ai tutor is broken 
Update: backend fixxes V1.2.3 --beta   is pushed
Note erros are fin and to be ignored at this stage
     Next step is to fix thems and add mreo apps fix light and dark mode and try and make the first iso
update
Update: timestamp jul 15 19:10 — backend is fully working. `npm run typecheck` passes, `npm test` 16/16, the server boots on :4318 and all 13 GET routes plus POST tasks / POST focus / PUT settings / POST hardware/led return the expected JSON. Added a "Backend" section to the README covering env vars, schema, and the full REST surface.
Update: v1.2.5 --beta pushed at jul 15 ~19:50. Rewrote the Dashboard to merge in Home's today-view (greeting + stats + schedule + subjects + up next + app launcher + recent activity), brought the Home and Focus apps back from `later/apps/`, and ported the Focus timer's state machine to C at `os/lib/focus/` (libfocus.a + 7 passing tests). Sidebar now shows Dashboard, Home, AI Tutor, Focus, Settings. `npm run typecheck` clean across all six workspaces, `npm run build:shell` 220 kB / 70 modules, backend suite 16/16.

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

## Raspberry Pi Deployment

See [`system/linux-config/INSTALL.md`](system/linux-config/INSTALL.md) for full deployment instructions to Raspberry Pi hardware.

## Applications

1. **Home** — Dashboard with today's overview & quick actions
2. **Planner** — Calendar, assignments, exams, timetable
3. **Tasks** — Task management with priorities & categories
4. **Subjects** — Subject list, notes, revision tracking
5. **Focus** — Pomodoro timer & study sessions
6. **AI** — AI learning assistant (Ollama/llama.cpp)
7. **Statistics** — Learning analytics & trends
8. **Settings** — System, theme, hardware, network

## Hardware Services

- **ace-core**: Main OS service & IPC
- **ace-hardware**: Camera, GPIO, sensors, LEDs
- **ace-ai**: Local AI processing
- **ace-sync**: Data backup & syncing

## License

MIT

## dev log |

v1 was pushed at  (15 July 2026 at 15:42)
   initail com is still v1 with json files beng the main change 
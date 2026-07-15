# frontend/rust-iced — A.C.E OS · Rust+Iced port

Alternative A.C.E OS front-end written in **Rust + [Iced] v0.13**
(Elm-style, type-safe, virtual-DOM-ish widgets). Renders a single
window that fetches `/api/health` and `/api/users/me` from the
existing Express backend.

This is one of six port shells:

| Stack     | Path                    |
|-----------|-------------------------|
| Next.js   | `frontend/nextjs/`      |
| Rust+Iced | `frontend/rust-iced/` 👈 |
| Rust+Slint| `frontend/rust-slint/`  |
| C++ Qt    | `frontend/cpp-qt/`      |
| JavaFX    | `frontend/java-javafx/` |
| C GTK4    | `frontend/c-gtk4/`      |

[Iced]: https://iced.rs/

## Why Iced

* Pure-Rust, no C++ runtime → small release binary, easy cross-build.
* Elm-style `update`/`view` cycle → all UI state is reachable from the
  single `App` struct. Slightly more ceremony than Slint's reactive
  properties, but every transition is type-checked.
* `Task::perform` is the canonical escape hatch for async I/O — it
  guarantees the UI thread is never blocked by reqwest.

## Prerequisites

* Rust toolchain (`rustc` + `cargo`) ≥ 1.74. Install with [rustup].
* On the Pi 5, install the native deps for Iced's winit backend:
  ```bash
  sudo apt install -y libwayland-dev libxkbcommon-dev libssl-dev
  ```
* The A.C.E backend must be running on `http://localhost:4318`.

[rustup]: https://rustup.rs/

## Run

```bash
cd frontend/rust-iced
cargo run                            # debug build, opens a window
cargo run --release                  # much smaller + faster
```

## What the MVP shows

A single styled card with two rows:

* `Backend:` populated from `GET /api/health`
* `User:` populated from `GET /api/users/me`

A `Refresh` button re-fires both calls. If the backend is offline, an
`Error:` line appears below the card. The initial fetch is fired via
`Task::done(Message::Refresh)` so the user sees live state without
needing to click first.

## Files

```
frontend/rust-iced/
├── Cargo.toml
├── src/main.rs        # ~140 lines · state + update + view + fetch
└── README.md
```

## Pitfalls / notes

* `iced` requires EITHER an X server (`DISPLAY=:0`) or a Wayland
  compositor. On Wayfire (the Pi default) it works out of the box.
* We use `rustls-tls` rather than the default `native-tls` so the Pi
  does not need `libssl-dev` at runtime — only at Cargo build time
  for reqwest. The `libssl-dev` apt package above feeds only that.
* Don't hold a `reqwest::Client` inside `App` — constructing it per
  fetch keeps the type trivially clone-safe and avoids accidental
  reuse across incompatible runtimes in tests.

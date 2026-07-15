//! A.C.E OS · Rust + Slint 1.x front-end.
//!
//! MVP: open a window, fetch `GET /api/health` and `GET /api/users/me`
//! from the existing Express backend, render both values, allow the
//! button to re-fetch.
//!
//! The key concurrency rule documented by Slint is: **only the main
//! thread may touch Slint properties**. We side-step this by spawning
//! every blocking HTTP request on a worker thread and pumping the
//! result back to the UI via `slint::invoke_from_event_loop`, which
//! is the official cross-thread update primitive.

slint::include_modules!();

const BACKEND_BASE: &str = "http://localhost:4318";

#[derive(serde::Deserialize)]
struct Health {
    ok: bool,
    service: String,
}

#[derive(serde::Deserialize)]
struct UserMe {
    name: String,
}

fn main() -> Result<(), slint::PlatformError> {
    let ui = AppWindow::new()?;
    let ui_handle = ui.as_weak();

    ui.on_refresh_clicked(move || {
        let h = ui_handle.clone();
        spawn_fetch(h);
    });

    // Trigger an initial fetch so the window lands with live data.
    spawn_fetch(ui.as_weak());

    // Adds a subtle gradient backdrop — sits behind the Slint window
    // and gives the kiosk feel without needing a real wallpaper engine.
    ui.run()
}

fn spawn_fetch(ui: slint::Weak<AppWindow>) {
    ui.upgrade_in_event_loop(|w| {
        w.set_loading(true);
        w.set_error_text("".into());
    })
    .ok();

    std::thread::spawn(move || {
        let result = fetch_now();

        let _ = ui.upgrade_in_event_loop(move |w| match result {
            Ok((h, u)) => {
                w.set_backend_text(format!("{} ({})", h.service, if h.ok { "ok" } else { "down" }).into());
                w.set_user_text(u.name.into());
                w.set_error_text("".into());
                w.set_loading(false);
            }
            Err(e) => {
                w.set_error_text(format!("Error: {e}").into());
                w.set_loading(false);
            }
        });
    });
}

fn fetch_now() -> anyhow::Result<(Health, UserMe)> {
    use anyhow::Context;

    let client = reqwest::blocking::Client::builder()
        .user_agent("ace-rust-slint/0.1.0")
        .build()
        .context("client build")?;

    let h: Health = client
        .get(format!("{BACKEND_BASE}/api/health"))
        .send()
        .context("GET /api/health")?
        .json()
        .context("parse /api/health")?;

    let u: UserMe = client
        .get(format!("{BACKEND_BASE}/api/users/me"))
        .send()
        .context("GET /api/users/me")?
        .json()
        .context("parse /api/users/me")?;

    Ok((h, u))
}

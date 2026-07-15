//! A.C.E OS · Rust + Iced (v0.13) front-end.
//!
//! MVP scope: open a window, fetch `GET /api/health` and
//! `GET /api/users/me` from the A.C.E backend, render both values in a
//! row, allow a "Refresh" button to re-fetch.
//!
//! Architecture is the canonical Iced 0.13 split:
//!   - `Message`       — every event the runtime can dispatch
//!   - `App::update`   — pure state transition, returns `Task<Message>`
//!   - `App::view`     — pure rendering of `&self`
//!   - `fetch`         — async side-effect wrapped by `Task::perform`
//!
//! Async work does **not** happen inside `update()` directly — it is
//! spawned via `Task::perform`, and the resolved future is funneled
//! back into `update()` as a `Message::Fetched` variant. This guarantees
//! the UI is always derived from a state value (no torn renders).

use iced::widget::{button, column, container, row, text};
use iced::{Center, Element, Fill, Length, Task};
use serde::Deserialize;

const BACKEND_BASE: &str = "http://localhost:4318";

#[derive(Debug, Clone, Deserialize)]
struct Health {
    ok: bool,
    service: String,
}

#[derive(Debug, Clone, Deserialize)]
struct UserMe {
    name: String,
}

#[derive(Debug, Clone)]
enum Message {
    Refresh,
    Fetched(Result<(Health, UserMe), String>),
}

#[derive(Default)]
struct App {
    health: Option<Health>,
    user: Option<UserMe>,
    loading: bool,
    error: Option<String>,
}

impl App {
    fn update(&mut self, msg: Message) -> Task<Message> {
        match msg {
            Message::Refresh => {
                self.loading = true;
                self.error = None;
                Task::perform(fetch(), Message::Fetched)
            }
            Message::Fetched(Ok((h, u))) => {
                self.health = Some(h);
                self.user = Some(u);
                self.loading = false;
                Task::none()
            }
            Message::Fetched(Err(e)) => {
                self.loading = false;
                self.error = Some(e);
                Task::none()
            }
        }
    }

    fn view(&self) -> Element<Message> {
        let backend = self
            .health
            .as_ref()
            .map(|h| {
                if h.ok {
                    format!("{} (ok)", h.service)
                } else {
                    format!("{} (down)", h.service)
                }
            })
            .unwrap_or_else(|| "—".into());

        let username = self
            .user
            .as_ref()
            .map(|u| u.name.clone())
            .unwrap_or_else(|| "—".into());

        let err_line = self
            .error
            .as_ref()
            .map(|e| text(format!("Error: {e}")).color(iced::Color::from_rgb(0.96, 0.55, 0.55)));

        let refresh_label = if self.loading { "Refreshing…" } else { "Refresh" };

        let body = column![
            text("A.C.E OS").size(32),
            text("Rust + Iced shell · v0.13").size(13),
            row![kv("Backend", &backend)].spacing(8),
            row![kv("User", &username)].spacing(8),
            button(text(refresh_label).center())
                .padding([10, 22])
                .on_press_maybe(if self.loading { None } else { Some(Message::Refresh) }),
        ]
        .spacing(14)
        .max_width(540);

        let card = container(body)
            .padding(24)
            .style(|_t| iced::widget::container::Style {
                background: Some(iced::Color::from_rgba(1.0, 1.0, 1.0, 0.04).into()),
                border: iced::Border {
                    color: iced::Color::from_rgba(1.0, 1.0, 1.0, 0.10),
                    width: 1.0,
                    radius: 16.0.into(),
                },
                ..Default::default()
            });

        let content: Element<Message> = if let Some(err) = err_line {
            column![card, err].spacing(8).into()
        } else {
            card.into()
        };

        container(content)
            .padding(32)
            .center_x(Fill)
            .center_y(Fill)
            .into()
    }
}

fn kv(label: &str, value: &str) -> Element<'static, Message> {
    row![
        text(label.to_string()).size(11).color(iced::Color::from_rgb(0.58, 0.65, 0.78)),
        text(value.to_string()).size(15),
    ]
    .spacing(10)
    .into()
}

async fn fetch() -> Result<(Health, UserMe), String> {
    let client = reqwest::Client::builder()
        .user_agent("ace-rust-iced/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let h: Health = client
        .get(format!("{BACKEND_BASE}/api/health"))
        .send()
        .await
        .map_err(|e| format!("GET /api/health: {e}"))?
        .json()
        .await
        .map_err(|e| format!("parse /api/health: {e}"))?;

    let u: UserMe = client
        .get(format!("{BACKEND_BASE}/api/users/me"))
        .send()
        .await
        .map_err(|e| format!("GET /api/users/me: {e}"))?
        .json()
        .await
        .map_err(|e| format!("parse /api/users/me: {e}"))?;

    Ok((h, u))
}

fn main() -> iced::Result {
    // Iced v0.13's `application` returns a `Boot` that we resolve by
    // giving it both the initial state and an initial Task — the
    // `Task::done(Message::Refresh)` triggers the first fetch without
    // requiring a UI button press.
    iced::application("A.C.E OS · Iced", App::update, App::view).run_with(|| {
        (App::default(), Task::done(Message::Refresh))
    })
}

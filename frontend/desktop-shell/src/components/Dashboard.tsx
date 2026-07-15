import React, { useEffect, useMemo, useState } from 'react';
import {
  api,
  APP_REGISTRY,
  classNames,
  formatTime,
  relativeFromNow,
  useAceStore,
  type CalendarEvent,
  type Subject,
  type Task,
} from '@ace/shared';

/**
 * Welcome + today dashboard. The single landing screen for the
 * website-style shell. Combines:
 *
 *   1. Greeting + clock + username + avatar (first-run warmth)
 *   2. Stat row: today's events, open tasks, completed-today
 *   3. Two-column body: today's schedule (left) + subjects progress (right)
 *   4. Up next: the next incomplete task with a "Mark done" CTA
 *   5. App launcher grid: tiles for every app in APP_REGISTRY
 *   6. Recent activity: thin strip of unread notifications
 *
 * The launcher grid is built from `APP_REGISTRY` rather than a hand-rolled
 * list so any new app that registers itself in `apps-registry.ts` shows
 * up here automatically. The "Home" entry navigates to the standalone
 * Home app for users who want a full-screen daily summary.
 *
 * All data is read-only and computed client-side over the cached API
 * responses, so the first paint lands instantly even before the network
 * round-trip completes. Each section has its own empty state for the
 * case where the backend is offline.
 */
export const Dashboard: React.FC = () => {
  const username = useAceStore((s) => s.username);
  const avatar = useAceStore((s) => s.avatar);
  const notifications = useAceStore((s) => s.notifications);
  const clearNotifications = useAceStore((s) => s.clearNotifications);
  const markRead = useAceStore((s) => s.markRead);
  const setView = useAceStore((s) => s.setActiveView);
  const bundledCount = useAceStore((s) => s.bundledBackgrounds.length);
  const pushNotification = useAceStore((s) => s.pushNotification);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [now, setNow] = useState<Date>(() => new Date());
  const [loaded, setLoaded] = useState(false);

  // Tick every 60s — the greeting time-of-day bucket only changes around
  // dawn/lunch/dusk so 1-minute resolution is plenty.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Load the data the dashboard surfaces. Promise.allSettled so a single
  // failed endpoint (e.g. backend offline) doesn't blank the whole page.
  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      api.listEvents(),
      api.listTasks(),
      api.listSubjects(),
    ]).then(([e, t, s]) => {
      if (cancelled) return;
      if (e.status === 'fulfilled') setEvents(e.value);
      if (t.status === 'fulfilled') setTasks(t.value);
      if (s.status === 'fulfilled') setSubjects(s.value);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // ---- Greeting + date ----
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 5) return 'Burning the midnight oil';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 22) return 'Good evening';
    return 'Late night study';
  }, [now]);

  const dateLong = now.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // ---- Stats ----
  const today = useMemo(
    () =>
      events
        .filter((ev) => sameDay(new Date(ev.start), now))
        .sort((a, b) => +new Date(a.start) - +new Date(b.start)),
    [events, now],
  );
  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const nextUp = openTasks[0];
  const completedToday = useMemo(
    () =>
      tasks.filter(
        (t) => t.completed && t.completedAt && sameDay(new Date(t.completedAt), now),
      ),
    [tasks, now],
  );

  const averageProgress =
    subjects.length === 0
      ? 0
      : subjects.reduce((acc, s) => acc + (s.progress ?? 0), 0) / subjects.length;

  const recent = useMemo(
    () => notifications.filter((n) => !n.read).slice(0, 4),
    [notifications],
  );

  async function markDone(t: Task) {
    const next = await api.updateTask(t.id, { completed: true });
    setTasks((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    pushNotification({ title: 'Task done', message: t.title, category: 'task' });
  }

  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-7" data-testid="dashboard">
      {/* ---------- Greeting ---------- */}
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ace-muted">
          <span>{dateLong}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {greeting}{' '}
          <span style={{ color: 'var(--ace-accent)' }} data-testid="dashboard-username">
            {username}
          </span>
          <span aria-hidden className="ml-1">{avatar}</span>
        </h1>
        <p className="text-ace-muted text-sm sm:text-base max-w-2xl">
          Welcome to your study workspace. Pick an app below to dive in, or
          customise the look from <button
            type="button"
            onClick={() => setView('settings')}
            className="underline hover:text-white"
          >Settings</button>.
        </p>
      </header>

      {/* ---------- Stat row ---------- */}
      <section aria-label="Stats" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Today"
          value={`${today.length} event${today.length === 1 ? '' : 's'}`}
          hint={today[0] ? `Next: ${formatTime(today[0].start)}` : 'No events scheduled'}
          accent="#60a5fa"
        />
        <StatCard
          label="Open tasks"
          value={`${openTasks.length}`}
          hint={nextUp ? `Next: ${nextUp.title}` : 'All clear'}
          accent="#a78bfa"
        />
        <StatCard
          label="Completed today"
          value={`${completedToday.length}`}
          hint={completedToday.length ? 'Nice momentum 🦊' : 'Let’s get one done'}
          accent="#34d399"
        />
      </section>

      {/* ---------- Schedule + subjects ---------- */}
      <section
        aria-label="Today"
        className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4"
      >
        <div className="ace-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Today’s schedule</h2>
            <button
              type="button"
              className="text-xs text-ace-muted hover:text-white transition"
              onClick={() => setView('home')}
            >
              Full home view →
            </button>
          </div>
          {!loaded ? (
            <p className="text-sm text-ace-muted">Loading…</p>
          ) : today.length === 0 ? (
            <p className="text-sm text-ace-muted">No events today. Quiet day 🌱</p>
          ) : (
            <ul className="space-y-2">
              {today.slice(0, 6).map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition"
                >
                  <div
                    className="w-1.5 h-10 rounded-full flex-none"
                    style={{
                      background:
                        ev.type === 'exam' ? '#f87171' :
                        ev.type === 'class' ? '#60a5fa' :
                        ev.type === 'assignment' ? '#a78bfa' : '#fbbf24',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="text-xs text-ace-muted">
                      {formatTime(ev.start)} – {formatTime(ev.end)}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </div>
                  </div>
                  <span className="ace-pill text-xs uppercase">{ev.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ace-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Subjects</h2>
            <span className="text-[10px] text-ace-muted">
              avg {Math.round(averageProgress * 100)}%
            </span>
          </div>
          {!loaded ? (
            <p className="text-sm text-ace-muted">Loading…</p>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-ace-muted">No subjects yet.</p>
          ) : (
            <>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-violet-400"
                  style={{ width: `${Math.round(averageProgress * 100)}%` }}
                />
              </div>
              <ul className="space-y-1.5">
                {subjects.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full flex-none" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-ace-muted tabular-nums">
                      {Math.round(s.progress * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* ---------- Up next ---------- */}
      <section aria-label="Up next">
        <div className="ace-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Up next</h2>
            {nextUp && (
              <span className="text-xs text-ace-muted">
                Added {relativeFromNow(nextUp.createdAt)}
              </span>
            )}
          </div>
          {!loaded ? (
            <p className="text-sm text-ace-muted">Loading…</p>
          ) : nextUp ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={classNames('ace-pill text-xs uppercase', priorityClass(nextUp.priority))}
              >
                {nextUp.priority}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{nextUp.title}</div>
                {nextUp.dueDate && (
                  <div className="text-xs text-ace-muted">Due {formatTime(nextUp.dueDate)}</div>
                )}
              </div>
              <button
                type="button"
                className="ace-btn-primary"
                onClick={() => void markDone(nextUp)}
                data-testid="dashboard-mark-done"
              >
                Mark done
              </button>
            </div>
          ) : (
            <p className="text-sm text-ace-muted">
              No outstanding tasks. Time to plan the next one.
            </p>
          )}
        </div>
      </section>

      {/* ---------- App launcher ---------- */}
      <section aria-label="Apps">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ace-muted mb-3">
          Jump back in
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {APP_REGISTRY
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setView(app.id)}
                data-testid={`dashboard-app-${app.id}`}
                className="group relative rounded-2xl border p-4 text-left transition overflow-hidden active:scale-[0.99] hover:border-white/30"
                style={{
                  borderColor: 'var(--ace-border)',
                  background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--ace-bg-deep) 90%, transparent) 0%, color-mix(in srgb, var(--ace-bg-deep) 70%, transparent) 100%)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `radial-gradient(420px 140px at 0% 0%, ${app.accent}22, transparent 60%)`,
                  }}
                />
                <div className="relative flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${app.accent} 0%, color-mix(in srgb, ${app.accent} 60%, #0b1020) 100%)`,
                      boxShadow: `0 4px 10px ${app.accent}55`,
                    }}
                    aria-hidden
                  >
                    {app.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold leading-snug truncate">{app.name}</div>
                    <div className="text-[11px] text-ace-muted line-clamp-2 mt-0.5">
                      {app.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
        </div>
      </section>

      {/* ---------- Recent activity ---------- */}
      <section aria-label="Recent notifications">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ace-muted">
            Recent activity
          </h2>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearNotifications}
              className="text-xs text-ace-muted hover:text-white transition"
            >
              Clear all
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div
            className="ace-card text-sm text-ace-muted flex items-center gap-2"
            style={{ background: 'color-mix(in srgb, var(--ace-bg-deep) 60%, transparent)' }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--ace-accent)', opacity: 0.6 }}
              aria-hidden
            />
            All quiet here. New study nudges will appear here.
            {bundledCount > 0 && (
              <span className="ml-auto text-[11px] opacity-80">
                {bundledCount} bundled background{bundledCount === 1 ? '' : 's'} ready
              </span>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((n) => (
              <li
                key={n.id}
                onClick={() => markRead(n.id)}
                className="ace-card cursor-pointer flex items-start gap-3 hover:border-white/30 transition"
              >
                <span
                  className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                  style={{ background: 'var(--ace-accent)' }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-snug">{n.title}</div>
                  <p className="text-xs text-ace-muted mt-0.5 line-clamp-2">{n.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Small components                                                            */
/* -------------------------------------------------------------------------- */

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, accent }) => (
  <div
    className="rounded-2xl border border-white/10 p-4"
    style={{ background: `linear-gradient(135deg, ${accent}33, transparent 60%)` }}
  >
    <div className="text-xs uppercase tracking-wide text-ace-muted">{label}</div>
    <div className="text-2xl font-semibold mt-1">{value}</div>
    {hint && <div className="text-xs text-ace-muted mt-1">{hint}</div>}
  </div>
);

function priorityClass(p: Task['priority']) {
  return (
    p === 'urgent' ? 'bg-red-500/30 border-red-400/30 text-red-100' :
    p === 'high' ? 'bg-orange-500/20 border-orange-400/30 text-orange-100' :
    p === 'medium' ? 'bg-amber-500/20 border-amber-400/30 text-amber-100' :
    'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
  );
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

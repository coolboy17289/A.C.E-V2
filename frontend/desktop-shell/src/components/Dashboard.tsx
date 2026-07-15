import React, { useEffect, useMemo, useState } from 'react';
import { Icon, useAceStore } from '@ace/shared';

/**
 * Welcome dashboard \u2014 the default view when the shell mounts (or when
 * the user clicks the Dashboard nav item). Goal of this view is to
 * answer "what can I do here?" in one glance and to provide two obvious
 * next-steps so first-time users hit the AI Tutor or Settings without
 * searching.
 *
 * Sections, in order:
 *   1. Greeting + clock \u2014 personalises the page using the saved
 *      username and current time of day.
 *   2. Quick-launch cards \u2014 big tiles for AI Tutor and Settings so
 *      there's a clear "where do I start?" path even on first run.
 *   3. Recent activity \u2014 peek of the latest unread notifications.
 *      Empty state explains that everything's been seen; clicking
 *      Clear all dismisses them.
 *   4. Tip card \u2014 short explainer for the wallpaper drop-zone so the
 *      user knows how to personalise without opening Settings.
 */
export const Dashboard: React.FC = () => {
  const username = useAceStore((s) => s.username);
  const avatar = useAceStore((s) => s.avatar);
  const notifications = useAceStore((s) => s.notifications);
  const clearNotifications = useAceStore((s) => s.clearNotifications);
  const markRead = useAceStore((s) => s.markRead);
  const setActive = useAceStore((s) => s.setActiveView);
  const bundledCount = useAceStore((s) => s.bundledBackgrounds.length);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // Tick every 60s \u2014 the greeting time-of-day bucket only changes
    // around dawn/lunch/dusk so 1-minute resolution is plenty.
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

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

  const recent = useMemo(
    () => notifications.filter((n) => !n.read).slice(0, 4),
    [notifications],
  );

  return (
    <div className="p-5 sm:p-8 max-w-5xl mx-auto space-y-8">
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
          Welcome to your study workspace. Pick an app to get started, or
          customise the look from <button
            type="button"
            onClick={() => setActive('settings')}
            className="underline hover:text-white"
          >Settings</button>.
        </p>
      </header>

      {/* ---------- Quick-launch cards ---------- */}
      <section aria-label="Quick launch">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ace-muted mb-3">
          Jump back in
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <QuickLaunchCard
            data-testid="quick-ai"
            accent="#22d3ee"
            icon="ai"
            title="AI Tutor"
            description="Ask study questions, run a quiz, or draft a revision plan."
            cta="Open chat"
            onClick={() => setActive('ai')}
          />
          <QuickLaunchCard
            data-testid="quick-settings"
            accent="#94a3b8"
            icon="settings"
            title="Settings"
            description="Theme, accent colour, wallpaper and profile."
            cta="Customise"
            onClick={() => setActive('settings')}
          />
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

      {/* ---------- Tip ---------- */}
      <section aria-label="Tip">
        <div
          className="ace-card flex items-start gap-3 text-sm"
          style={{
            background:
              'color-mix(in srgb, var(--ace-accent-soft) 70%, transparent)',
            border: '1px solid color-mix(in srgb, var(--ace-accent) 30%, transparent)',
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--ace-bg-deep)', color: 'var(--ace-accent)' }}
            aria-hidden
          >
            <Icon name="image" size={20} />
          </div>
          <div className="min-w-0">
            <div className="font-medium">
              {bundledCount > 0
                ? `${bundledCount} bundled background${bundledCount === 1 ? '' : 's'} ready to use`
                : 'Personalise the desktop'}
            </div>
            <p className="text-xs text-ace-muted mt-0.5 leading-relaxed">
              Open <button
                type="button"
                onClick={() => setActive('settings')}
                className="underline hover:text-white"
              >Settings &raquo; Wallpaper</button> to pick a preset or upload your own image. Drop a PNG
              into <code className="px-1 py-0.5 rounded bg-black/30">frontend/desktop-shell/public/backgrounds/</code>{' '}
              to add more.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

/* -------------------------------------------------------------------------- */

interface QuickLaunchCardProps {
  accent: string;
  icon: 'ai' | 'settings';
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
}

const QuickLaunchCard: React.FC<QuickLaunchCardProps> = ({
  accent,
  icon,
  title,
  description,
  cta,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative rounded-2xl border p-5 text-left transition overflow-hidden active:scale-[0.99]"
    style={{
      borderColor: 'var(--ace-border)',
      background:
        'linear-gradient(135deg, color-mix(in srgb, var(--ace-bg-deep) 90%, transparent) 0%, color-mix(in srgb, var(--ace-bg-deep) 70%, transparent) 100%)',
      backdropFilter: 'blur(8px)',
    }}
  >
    {/* Accent glow that intensifies on hover. Uses an inset shadow so
        the card stays flat and never paints over the wallpaper stripes. */}
    <div
      aria-hidden
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
      style={{
        background: `radial-gradient(600px 200px at 0% 0%, ${accent}22, transparent 60%)`,
      }}
    />
    <div className="relative flex items-center gap-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 60%, #0b1020) 100%)`,
          boxShadow: `0 6px 16px ${accent}55`,
          color: 'white',
        }}
      >
        <Icon name={icon} size={28} style={{ color: 'white', stroke: 'white' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold leading-snug">{title}</div>
        <p className="text-xs text-ace-muted mt-1 line-clamp-2">{description}</p>
      </div>
      <span
        className="hidden sm:inline-flex items-center gap-1 text-xs font-medium opacity-70 group-hover:opacity-100 transition"
        style={{ color: accent }}
      >
        {cta}
        <Icon name="chevron-right" size={14} />
      </span>
    </div>
  </button>
);

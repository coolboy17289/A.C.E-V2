import React, { useEffect, useState } from 'react';
import { useAceStore } from '@ace/shared';

interface ViewMeta {
  title: string;
  subtitle: string;
}

/**
 * Subset of `ActiveView` for which we know how to render a styled
 * header. The Sidebar only surfaces shipped app ids in its nav, so in
 * practice `activeView` is only ever one of these; typing `VIEW_META`
 * as a `Record<ShippedView, ViewMeta>` keeps TypeScript honest if a
 * parked app id ever leaks into the store.
 */
type ShippedView = 'dashboard' | 'ai' | 'focus' | 'home' | 'settings';

const SHIPPED_VIEWS = new Set<ShippedView>(['dashboard', 'ai', 'focus', 'home', 'settings']);

const VIEW_META: Record<ShippedView, ViewMeta> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Today\u2019s overview and quick actions.',
  },
  ai: {
    title: 'AI Tutor',
    subtitle: 'Ask anything about your study topics. Answers are study-aware.',
  },
  focus: {
    title: 'Focus',
    subtitle: 'Pomodoro timer with break tracking and session history.',
  },
  home: {
    title: 'Home',
    subtitle: 'A full-screen look at today\u2019s events, tasks and subjects.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Theme, wallpaper, profile and system preferences.',
  },
};

/**
 * Slim header that sits above the active view. Replaces the OS-style
 * TopBar -- the sidebar carries nav, window chrome is gone, the bell
 * lives in the sidebar footer. The header just sets context: which view
 * am I in, and what time is it.
 */
export const SiteHeader: React.FC = () => {
  const active = useAceStore((s) => s.activeView);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // 30s cadence is plenty; the seconds never matter for the label.
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Shipped views cover every activeView a user can reach via the
  // sidebar. The narrow + lookup pattern keeps the union of concerns
  // tight without making TypeScript's Record exhaustiveness fight us.
  const keyed: ShippedView = SHIPPED_VIEWS.has(active as ShippedView)
    ? (active as ShippedView)
    : 'dashboard';
  const meta = VIEW_META[keyed];

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <header
      className="flex items-center justify-between gap-4 px-5 sm:px-8 py-4 border-b backdrop-blur-sm flex-none"
      style={{
        borderColor: 'var(--ace-border)',
        background: 'color-mix(in srgb, var(--ace-bg-deep) 60%, transparent)',
      }}
    >
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">
          {meta.title}
        </h1>
        <p className="text-xs text-ace-muted truncate">{meta.subtitle}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="ace-pill font-mono tabular-nums hidden sm:flex items-center gap-2"
          data-testid="site-clock"
          title="Local time"
        >
          <span>{time}</span>
          <span className="text-ace-muted/70">{' '}{'\u00b7'}{' '}</span>
          <span className="text-ace-muted">{date}</span>
        </div>
      </div>
    </header>
  );
};

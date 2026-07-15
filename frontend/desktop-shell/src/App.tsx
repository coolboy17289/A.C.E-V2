import React, { useEffect } from 'react';
import { api, useAceStore, WALLPAPER_UNSET_SENTINEL, type UserPreferences } from '@ace/shared';
import { AppHost } from './components/AppHost';
import { Dashboard } from './components/Dashboard';
import { NotificationCenter } from './components/NotificationCenter';
import { Sidebar } from './components/Sidebar';
import { SiteHeader } from './components/SiteHeader';
import { ToastStack } from './components/ToastStack';
import { Wallpaper } from './components/Wallpaper';

/**
 * Root component for the website-style desktop shell.
 *
 * Layout (no window chrome, no boot screen):
 *
 *     +------------------------------------------------------+
 *     |                  <Wallpaper /> (background)          |
 *     |                                                      |
 *     | +--------+ +---------------------------------------+ |
 *     | |        | |           <SiteHeader />              | |
 *     | |        | +---------------------------------------+ |
 *     | | Sidebar| |                                       | |
 *     | |        | |   <Dashboard />  /  <AppHost appId=…> | |
 *     | |        | |                                       | |
 *     | |        | |  ... active view's scrollable area ...| |
 *     | +--------+ +---------------------------------------+ |
 *     |                                                      |
 *     |  <NotificationCenter /> anchored to sidebar bell     |
 *     |  <ToastStack /> bottom-right corner                  |
 *     +------------------------------------------------------+
 *
 * Persistence:
 *   - `useAceStore` is hydrated from localStorage *before* it is created
 *     so the first paint already shows the wallpaper + active view.
 *   - Every setter (`setWallpaper`, `setPreferences`, `setActiveView`,
 *     etc.) writes its slice back to the same key. A server round-trip
 *     is attempted in the background but UI never blocks on it.
 */
export function App() {
  const prefs = useAceStore((s) => s.preferences);
  const setPreferences = useAceStore((s) => s.setPreferences);
  const setWallpaper = useAceStore((s) => s.setWallpaper);
  const activeView = useAceStore((s) => s.activeView);
  const sidebarCollapsed = useAceStore((s) => s.sidebarCollapsed);

  // -------- Apply theme + wallpaper on document root --------
  //
  // Single place that mirrors the store into CSS custom properties. By
  // doing it in React (rather than scattered through every setter) we
  // guarantee the <html> element stays in sync with whatever state the
  // store has, regardless of whether the change came from a UI click
  // or from a hydrate-from-storage event.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ace-accent', prefs.accentColor || '#60a5fa');
    document.documentElement.dataset.theme = prefs.theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.reduceMotion = prefs.reduceMotion ? 'true' : 'false';
  }, [prefs.accentColor, prefs.theme, prefs.reduceMotion]);

  // -------- Apply font-size scale to <html> --------
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--ace-font-scale',
      String(prefs.fontScale ?? 1),
    );
  }, [prefs.fontScale]);

  // -------- Default to mobile-collapsed sidebar on narrow viewports --------
  //
  // We don't want to clobber the user's saved preference, so we only
  // *initialise* collapsed when the viewport is already narrow and the
  // user hasn't expressed a preference. Reading the store via a
  // microtask in the same `useEffect` ensures we only fire once.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const narrow = window.matchMedia('(max-width: 767px)').matches;
    if (!narrow) return;
    // Don't override an explicit previous choice (sidebarCollapsed === true is fine).
    if (sidebarCollapsed === false) {
      useAceStore.getState().setSidebarCollapsed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- Best-effort backend sync on mount --------
  //
  // The UI is fully usable without the backend (preferences and view
  // are mirrored to localStorage). This block just attempts to merge
  // any canonical values the backend has. Failures are non-blocking
  // and surface as a toast so the user knows what's happening.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await api.getUser();
        if (cancelled) return;
        const initial = useAceStore.getState().preferences;
        const backend = user.preferences;
        const keep = <K extends keyof UserPreferences>(k: K): UserPreferences[K] => {
          const current = useAceStore.getState().preferences[k];
          return current === initial[k] ? (backend[k] ?? initial[k]) : current;
        };
        setPreferences({
          accentColor: keep('accentColor'),
          fontScale: keep('fontScale'),
          reduceMotion: keep('reduceMotion'),
          notificationsEnabled: keep('notificationsEnabled'),
          theme: keep('theme'),
          username: keep('username') || backend.username || user.name,
        });
        const settings = await api.getSettings();
        if (cancelled) return;
        const s = settings as { wallpaper?: unknown };
        if (typeof s.wallpaper === 'string' && s.wallpaper) {
          // Only adopt the backend wallpaper if the user hasn't chosen
          // one yet. The sentinel marks "never set"; any other value
          // (including DEFAULT_WALLPAPER_CSS) is a deliberate choice
          // and must win over the backend's value.
          const localWall = useAceStore.getState().wallpaper;
          if (localWall === WALLPAPER_UNSET_SENTINEL) {
            setWallpaper(s.wallpaper);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[ace] settings hydration failed', err);
        useAceStore.getState().toast({
          title: 'Working offline',
          body: 'Showing your saved settings. Backend may be offline.',
          variant: 'warning',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative w-full h-full overflow-hidden text-ace-ink"
      style={{ ['--ace-font-scale' as string]: String(prefs.fontScale ?? 1) }}
      data-testid="ace-shell"
    >
      <Wallpaper />

      {/* Horizontal flex: sidebar (left) + content (right). The Sidebar
          is a self-contained <aside>; the right column is a vertical
          flex stack with header + scrollable content. */}
      <div className="absolute inset-0 flex">
        <div className="relative">
          <Sidebar />
          <NotificationCenter />
        </div>

        <main className="flex-1 flex flex-col min-w-0">
          <SiteHeader />
          <div
            className="flex-1 overflow-y-auto"
            role="region"
            aria-label="Application content"
          >
            {activeView === 'dashboard' ? (
              <Dashboard />
            ) : (
              <AppHost appId={activeView} />
            )}
          </div>
        </main>
      </div>

      <ToastStack />
    </div>
  );
}

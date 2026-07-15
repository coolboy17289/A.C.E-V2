// Global store for the desktop shell *and* all apps.
// Apps use this to communicate with the shell: open notifications, register
// events, request focus, etc.

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  AppId,
  NotificationRecord,
  SystemToast,
  UserPreferences,
} from './types.js';
import { APP_REGISTRY } from './apps-registry.js';
import { DEFAULT_WALLPAPER_CSS, type WallpaperPreset } from './wallpapers.js';

/* --------------------------------------------------------------------------
 * Persistence + wallpaper sentinel
 *
 * Everything the user customises (wallpaper, theme/accent, active view,
 * sidebar collapse state) is mirrored into localStorage under a single
 * JSON blob so the webapp boots straight into the user's last-known layout
 * — no backend, no setup screen, no flicker. The backend is still pinged
 * best-effort after first paint; nothing in the UI blocks on it.
 *
 * The wallpaper has a subtle extra concern: we need to distinguish the
 * state "user has never set a wallpaper" from "user explicitly chose
 * the default Aurora gradient". Both leave `wallpaper` set to a real
 * CSS string, so a string equality check isn't enough. We do this by
 * using a sentinel constant as the *initial* wallpaper value (only
 * before the user or the backend has set one). The sentinel is never
 * persisted — the first `setWallpaper` call replaces it.
 * ------------------------------------------------------------------------ */

export const USER_STATE_STORAGE_KEY = 'ace:userstate';

/**
 * Sentinel value used by the wallpaper store before any wallpaper is
 * explicitly chosen. Exported so callers (e.g. App.tsx) can decide
 * whether to adopt the backend's wallpaper on mount — only if local
 * state is still at the sentinel has the user made *no* choice yet.
 */
export const WALLPAPER_UNSET_SENTINEL = '__ACE_WALLPAPER_UNSET__';

/**
 * The slice we round-trip to/from localStorage. Anything not in this
 * shape is intentionally NOT persisted (notifications, toasts, etc.).
 */
type PersistedUserState = {
  wallpaper?: string;
  preferences?: Partial<UserPreferences>;
  activeView?: ActiveView;
  sidebarCollapsed?: boolean;
};

function safeReadPersisted(): PersistedUserState {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(USER_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Defensive: if we ever change the schema, unknown keys survive but
    // missing keys fall through to defaults. Avoids wiping user data on
    // a partial load failure.
    return parsed && typeof parsed === 'object' ? (parsed as PersistedUserState) : {};
  } catch {
    return {};
  }
}

function safeWritePersisted(patch: PersistedUserState) {
  if (typeof localStorage === 'undefined') return;
  try {
    const current = safeReadPersisted();
    const next = { ...current, ...patch };
    localStorage.setItem(USER_STATE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private-browsing — best-effort */
  }
}

export type ActiveView = 'dashboard' | AppId;

interface AceState {
  // User / preferences
  username: string;
  avatar: string; // emoji or short identifier; the actual visual is rendered
  preferences: UserPreferences;
  setPreferences: (p: Partial<UserPreferences>) => void;
  setUser: (username: string, avatar: string) => void;

  // Wallpaper + theming
  /**
   * Either a CSS background string (preset or hand-built) or a `data:image/...`
   * url pointing at an uploaded image. Stored locally so the desktop stays
   * themed before the backend has responded.
   */
  wallpaper: string;
  setWallpaper: (css: string) => void;

  /**
   * Image presets auto-discovered from `desktop-shell/public/backgrounds/`
   * at build/dev time via `import.meta.glob` in `backgrounds-bridge.ts`.
   * Empty until the bridge fires on boot — the Settings app merges this
   * list in front of the static CSS presets so newly-dropped PNGs are
   * picked up automatically without code edits.
   */
  bundledBackgrounds: WallpaperPreset[];
  setBundledBackgrounds: (presets: WallpaperPreset[]) => void;

  // -------- Active view + sidebar --------
  //
  // Replaces the old `windows`-based routing. The website-style shell
  // shows exactly one view at a time, picked from `activeView`. Persisted
  // so the app reopens on the view the user was last using.
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;

  /** True = collapsed icon-only rail, false = labelled wide rail. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Notifications
  notifications: NotificationRecord[];
  pushNotification: (n: Omit<NotificationRecord, 'id' | 'ts' | 'read'>) => void;
  markRead: (id: string) => void;
  clearNotifications: () => void;
  toasts: SystemToast[];
  toast: (t: Omit<SystemToast, 'id' | 'ts'>) => void;
  dismissToast: (id: string) => void;

  // Sidebar bell-button popover state. Kept separate from the (removed)
  // launcher drawer so future launchers don't accidentally suppress it.
  notifCenterOpen: boolean;
  setNotifCenterOpen: (open: boolean) => void;
  toggleNotifCenter: () => void;
}

const defaultPrefs: UserPreferences = {
  theme: 'dark',
  accentColor: '#60a5fa',
  fontScale: 1,
  notificationsEnabled: true,
  reduceMotion: false,
  username: 'Student',
};

// Hydrate from localStorage *before* the store is created so the very
// first React paint already shows the correct view + wallpaper. Reading
// here means we don't flash the dashboard then swap to the user's last
// view after a mount-time useEffect fires.
const _persisted = safeReadPersisted();
const hydratePrefs: UserPreferences = {
  ...defaultPrefs,
  ...(_persisted.preferences ?? {}),
  // If the saved username is empty (e.g. cleared in Settings) fall back
  // to the canonical default. Prevents the greeting from saying ", ".
  username:
    (_persisted.preferences?.username ?? defaultPrefs.username) || defaultPrefs.username,
};

export const useAceStore = create<AceState>()(
  subscribeWithSelector((set, get) => ({
    username: hydratePrefs.username,
    avatar: '🦊',
    preferences: hydratePrefs,
    setPreferences: (p) =>
      set((s) => {
        const next = { ...s.preferences, ...p };
        // Persist immediately so reloads stay consistent. We persist the
        // full preferences slice (cheap) rather than try to compute a
        // delta — UI fields flip often enough that diffing is more
        // error-prone than just resaving.
        safeWritePersisted({ preferences: next });
        return { preferences: next };
      }),
    setUser: (username, avatar) =>
      set(() => {
        safeWritePersisted({ preferences: { username } });
        return { username, avatar };
      }),

    // Initial wallpaper: if the user has saved a real CSS string to
    // localStorage use it; otherwise stay at the sentinel so the
    // backend hydration in App.tsx can replace it with its value
    // without clobbering a deliberate user choice. `DEFAULT_WALLPAPER_CSS`
    // is only loaded lazily once the user explicitly picks "Aurora"
    // in Settings or the backend sync completes.
    wallpaper: _persisted.wallpaper || WALLPAPER_UNSET_SENTINEL,
    setWallpaper: (css) =>
      set(() => {
        const value = css || DEFAULT_WALLPAPER_CSS;
        safeWritePersisted({ wallpaper: value });
        return { wallpaper: value };
      }),

    bundledBackgrounds: [],
    setBundledBackgrounds: (presets) => set({ bundledBackgrounds: presets }),

    activeView: _persisted.activeView ?? 'dashboard',
    setActiveView: (v) =>
      set(() => {
        safeWritePersisted({ activeView: v });
        return { activeView: v };
      }),

    sidebarCollapsed: _persisted.sidebarCollapsed ?? false,
    setSidebarCollapsed: (collapsed) =>
      set(() => {
        safeWritePersisted({ sidebarCollapsed: collapsed });
        return { sidebarCollapsed: collapsed };
      }),

    notifications: [],
    pushNotification: (n) => {
      const id = `n${Math.random().toString(36).slice(2, 9)}`;
      const full: NotificationRecord = {
        ...n,
        id,
        ts: new Date().toISOString(),
        read: false,
      };
      set((s) => ({ notifications: [full, ...s.notifications].slice(0, 50) }));
      get().toast({ title: n.title, body: n.message, variant: 'info' });
    },
    markRead: (id) =>
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      })),
    clearNotifications: () => set({ notifications: [] }),
    toasts: [],
    toast: (t) => {
      const id = `t${Math.random().toString(36).slice(2, 9)}`;
      set((s) => ({
        toasts: [...s.toasts, { ...t, id, ts: Date.now() }].slice(-6),
      }));
      setTimeout(() => get().dismissToast(id), 4200);
    },
    dismissToast: (id) =>
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    notifCenterOpen: false,
    setNotifCenterOpen: (open) => set({ notifCenterOpen: open }),
    toggleNotifCenter: () => set((s) => ({ notifCenterOpen: !s.notifCenterOpen })),
  })),
);

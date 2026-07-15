import type { AppManifest } from './types.js';

/**
 * Slim, currently-shipped registry. Anything not listed here still has
 * working TypeScript types (`AppId` is unchanged) but the desktop shell
 * will not surface it. To re-enable an app, drop its `AppManifest` back in
 * here and follow the steps in `later/README.md`.
 *
 * Order notes:
 *   - `settings` (1) + `ai` (2) ship first; both were the original two.
 *   - `focus` (3) is the Pomodoro app, restored in v1.2.5.
 *   - The Dashboard nav item is pinned at the top of the sidebar by
 *     `Sidebar.tsx`, so it doesn't need a registry entry. Tasks /
 *     Subjects / Planner / Statistics remain in `later/apps/` and are
 *     intentionally NOT in the registry yet — re-enable them by moving
 *     the directory back and adding a manifest here.
 */
export const APP_REGISTRY: readonly AppManifest[] = [
  {
    id: 'settings',
    name: 'Settings',
    description: 'Profile, theme, wallpaper, network, device & system',
    icon: '⚙️',
    accent: '#94a3b8',
    order: 1,
  },
  {
    id: 'ai',
    name: 'AI Tutor',
    description: 'Conversational study helper (Ollama + graceful fallback)',
    icon: '🧠',
    accent: '#22d3ee',
    order: 2,
  },
  {
    id: 'focus',
    name: 'Focus',
    description: 'Pomodoro timer with break tracking and session history',
    icon: '⏱️',
    accent: '#34d399',
    order: 3,
  },
] as const;

export function getApp(id: string): AppManifest | undefined {
  return APP_REGISTRY.find((a) => a.id === id);
}

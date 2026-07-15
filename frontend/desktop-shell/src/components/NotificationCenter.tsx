import React, { useEffect, useRef } from 'react';
import { Icon, classNames, useAceStore } from '@ace/shared';

/**
 * Compact notification popover anchored to the sidebar bell button.
 *
 * Why a popover (not the old floating panel)? The website layout has no
 * floating bell with a top-right anchor \u2014 the bell is in the sidebar's
 * bottom bar. So the panel now renders as a small card directly above
 * the bell, sized for narrow sidebars.
 *
 * Behaviour:
 *   - Opens on bell click (store toggles `notifCenterOpen`).
 *   - Closes on Escape, on outside click, or on the X button.
 *   - Clicking a notification marks it read; "Clear all" empties the list.
 *   - Auto-opens on a transition to "has unread" so a fresh push is
 *     visible without the user hunting for it.
 */
export const NotificationCenter: React.FC = () => {
  const open = useAceStore((s) => s.notifCenterOpen);
  const setOpen = useAceStore((s) => s.setNotifCenterOpen);
  const notifications = useAceStore((s) => s.notifications);
  const read = useAceStore((s) => s.markRead);
  const clearAll = useAceStore((s) => s.clearNotifications);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Auto-open on transition to "has unread". Reading the latest
  // hasUnread via a ref so the effect's dependency stays stable on the
  // notifications array length rather than flipping on every read.
  const hasUnreadRef = React.useRef(false);
  useEffect(() => {
    const hasUnread = notifications.some((n) => !n.read);
    if (hasUnread && !hasUnreadRef.current) setOpen(true);
    hasUnreadRef.current = hasUnread;
  }, [notifications, setOpen]);

  // Escape closes the popover (keyboard accessibility).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // Outside-click closes the popover. Anchored to the bell button via
  // a `data-testid` so we don't trap clicks on the bell itself.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-testid="bell-button"]')) return;
      setOpen(false);
    };
    // Use mousedown so a click that becomes a drag-to-select still
    // dismisses the popover the moment the press begins.
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Notifications"
      className={classNames(
        'absolute left-full bottom-3 ml-3 z-50 w-[320px] origin-bottom-left',
        'rounded-2xl border backdrop-blur-md shadow-window animate-fade-up',
      )}
      style={{
        borderColor: 'var(--ace-border)',
        background:
          'color-mix(in srgb, var(--ace-bg-deep) 92%, transparent)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 gap-2">
        <div className="flex items-center gap-2">
          <Icon name="bell" size={16} style={{ color: 'var(--ace-accent)' }} />
          <h3 className="font-semibold text-sm">Notifications</h3>
          {notifications.length > 0 && (
            <span className="text-[10px] text-ace-muted ml-1">
              ({notifications.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-ace-muted hover:text-white transition"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-ace-muted hover:bg-white/10 hover:text-white transition"
            aria-label="Close notifications"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>
      <ul
        className="px-2 pb-2 space-y-1 max-h-80 overflow-auto"
        data-testid="notification-list"
      >
        {notifications.length === 0 ? (
          <li className="px-3 py-6 text-sm text-ace-muted text-center">
            Nothing to see here.
          </li>
        ) : (
          notifications.map((n) => (
            <li
              key={n.id}
              onClick={() => read(n.id)}
              className={classNames(
                'p-3 rounded-xl border cursor-pointer transition',
                n.read
                  ? 'bg-white/[0.02] border-white/10'
                  : 'border-white/15',
              )}
              style={
                n.read
                  ? undefined
                  : { background: 'var(--ace-accent-soft)' }
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-snug">
                    {n.title}
                  </div>
                  <p className="text-xs text-ace-muted mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                </div>
                {!n.read && (
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: 'var(--ace-accent)' }}
                    aria-hidden
                  />
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

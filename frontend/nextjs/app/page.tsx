'use client';

/**
 * A.C.E OS Next.js (App Router) MVP shell.
 *
 * What this proves:
 *   1. Next.js can talk to the existing Express backend through the
 *      configured /api rewrite.
 *   2. Two endpoints come back with the expected shape:
 *        - GET /api/health  → { ok, service, ts }
 *        - GET /api/users/me → { id, name, preferences: {...} }
 *   3. A pure-client Refresh button triggers both calls again, so the
 *      state lifecycle (loading → loaded → loading) is observable.
 *
 * Out of scope (intentional): the full React dashboard, theming,
 * localStorage persistence, multiple apps, AI tutor wiring. Those all
 * live in `@ace/desktop-shell`; this page exists to validate that a
 * Next.js deployment is viable as an alternative target.
 */

import { useCallback, useEffect, useState } from 'react';

interface Health {
  ok: boolean;
  service: string;
  ts: string;
}

interface User {
  id: string;
  name: string;
  preferences: {
    theme: 'dark' | 'light' | 'auto';
    accentColor: string;
    username: string;
  };
}

interface Snapshot {
  health: Health | null;
  user: User | null;
}

export default function Home() {
  const [data, setData] = useState<Snapshot>({ health: null, user: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, uRes] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }),
        fetch('/api/users/me', { cache: 'no-store' }),
      ]);
      if (!hRes.ok || !uRes.ok) {
        throw new Error(`Backend ${hRes.status}/${uRes.status}`);
      }
      const health = (await hRes.json()) as Health;
      const user = (await uRes.json()) as User;
      setData({ health, user });
      setLastFetched(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <header>
        <p
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            fontSize: 11,
            color: '#94a3b8',
            margin: 0,
          }}
        >
          Next.js shell · v0.1.0
        </p>
        <h1 style={{ fontSize: 28, margin: '4px 0 6px' }}>
          A.C.E OS
          <span style={{ color: '#60a5fa', marginLeft: 8 }}>·</span>
        </h1>
        <p style={{ marginTop: 0, color: '#94a3b8' }}>
          Alternative front-end targeting the existing Express backend.
        </p>
      </header>

      <section
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '20px 24px',
          marginTop: 24,
        }}
      >
        <Row
          label="Backend"
          value={
            data.health
              ? `${data.health.service} (${data.health.ok ? 'ok' : 'down'})`
              : loading ? 'checking…' : '—'
          }
        />
        <Row
          label="User"
          value={data.user?.name ?? loading ? '…' : '—'}
          accent={data.user?.preferences.accentColor}
        />
        <Row
          label="Last fetched"
          value={
            lastFetched
              ? lastFetched.toLocaleTimeString()
              : 'never'
          }
        />
        {error && (
          <p style={{ color: '#fca5a5', marginTop: 12 }}>
            Error: {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          style={{
            marginTop: 18,
            padding: '10px 18px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.16)',
            background:
              'linear-gradient(135deg, rgba(96,165,250,0.5), rgba(167,139,250,0.5))',
            color: 'white',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </section>

      <footer
        style={{
          marginTop: 28,
          fontSize: 12,
          color: '#94a3b8',
          lineHeight: 1.6,
        }}
      >
        <code>/api/*</code> is rewritten by{' '}
        <code>next.config.mjs</code> to{' '}
        <code>http://localhost:4318/api/*</code> — the npm{' '}
        <code>@ace/backend</code> service must be running for this page
        to populate.
      </footer>
    </main>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: '1px dashed rgba(255,255,255,0.06)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: '#94a3b8',
        }}
      >
        {label}
      </span>
      <span style={{ fontWeight: 600, color: accent ?? '#e8eaf3' }}>
        {value}
      </span>
    </div>
  );
}

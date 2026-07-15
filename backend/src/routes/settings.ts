import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';

const APP_KEY = 'app';

export function registerSettingsRoutes(app: Application, db: Db) {
  app.get('/api/settings', ah((_req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings_kv').all() as Array<{ key: string; value: string }>;
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
    }
    res.json(out);
  }));

  app.put('/api/settings', ah(async (req, res) => {
    const payload = (req.body ?? {}) as Record<string, unknown>;
    const stmt = db.prepare(
      `INSERT INTO settings_kv (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    );
    const txn = db.transaction((entries: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(entries)) stmt.run(k, JSON.stringify(v));
    });
    txn({ ...payload, [APP_KEY]: payload });
    res.json({ ok: true });
  }));
}

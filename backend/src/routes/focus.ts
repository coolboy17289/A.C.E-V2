import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';
import { newId } from '../util/ids.js';
import { rowToSession } from '../db.js';
import type { FocusSession } from '@ace/shared';

export function registerFocusRoutes(app: Application, db: Db) {
  app.get('/api/focus', ah((_req, res) => {
    const rows = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT 200').all();
    res.json(rows.map(rowToSession));
  }));

  app.post('/api/focus', ah(async (req, res) => {
    const s = req.body as Omit<FocusSession, 'id'>;
    const id = newId('ses');
    db.prepare(
      `INSERT INTO sessions (id, started_at, ended_at, duration_minutes, break_minutes, type, subject_id, completed, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, s.startedAt, s.endedAt ?? null, s.durationMinutes, s.breakMinutes,
      s.type, s.subjectId ?? null, s.completed ? 1 : 0, s.notes ?? null,
    );
    res.status(201).json(rowToSession(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)));
  }));

  app.patch('/api/focus/:id', ah(async (req, res) => {
    const id = req.params.id;
    const patch = (req.body ?? {}) as Partial<FocusSession>;
    const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as ReturnType<typeof rowToSession> | undefined;
    if (!existing) { res.status(404).json({ error: 'not_found' }); return; }
    const merged = { ...existing, ...patch };
    db.prepare(
      `UPDATE sessions SET ended_at=?, duration_minutes=?, break_minutes=?, type=?, subject_id=?, completed=?, notes=? WHERE id=?`,
    ).run(
      merged.endedAt ?? null, merged.durationMinutes, merged.breakMinutes,
      merged.type, merged.subjectId ?? null, merged.completed ? 1 : 0,
      merged.notes ?? null, id,
    );
    res.json(rowToSession(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)));
  }));
}

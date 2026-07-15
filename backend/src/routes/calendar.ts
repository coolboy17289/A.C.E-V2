import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';
import { newId } from '../util/ids.js';
import { rowToEvent } from '../db.js';
import type { CalendarEvent } from '@ace/shared';

function validateEvt(e: Partial<CalendarEvent>) {
  if (!e.title || typeof e.title !== 'string') return 'title required';
  if (!e.type) return 'type required';
  if (!e.start || !e.end) return 'start/end required';
  if (!e.start.includes('T') || !e.end.includes('T')) return 'start/end must be ISO timestamps';
  return null;
}

export function registerCalendarRoutes(app: Application, db: Db) {
  app.get('/api/calendar', ah((_req, res) => {
    const rows = db.prepare('SELECT * FROM events ORDER BY start ASC').all();
    res.json(rows.map(rowToEvent));
  }));

  app.post('/api/calendar', ah(async (req, res) => {
    const e = req.body as Omit<CalendarEvent, 'id'>;
    const err = validateEvt(e);
    if (err) { res.status(400).json({ error: 'invalid', details: err }); return; }
    const id = newId('evt');
    db.prepare(
      `INSERT INTO events (id, title, type, start, "end", subject_id, notes, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, e.title, e.type, e.start, e.end, e.subjectId ?? null, e.notes ?? null, e.location ?? null);
    res.status(201).json(rowToEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(id)));
  }));

  app.patch('/api/calendar/:id', ah(async (req, res) => {
    const id = req.params.id;
    const patch = (req.body ?? {}) as Partial<CalendarEvent>;
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as ReturnType<typeof rowToEvent> | undefined;
    if (!existing) { res.status(404).json({ error: 'not_found' }); return; }
    const merged = { ...existing, ...patch };
    const err = validateEvt(merged);
    if (err) { res.status(400).json({ error: 'invalid', details: err }); return; }
    db.prepare(
      `UPDATE events SET title=?, type=?, start=?, "end"=?, subject_id=?, notes=?, location=? WHERE id=?`,
    ).run(merged.title, merged.type, merged.start, merged.end,
      merged.subjectId ?? null, merged.notes ?? null, merged.location ?? null, id);
    res.json(rowToEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(id)));
  }));

  app.delete('/api/calendar/:id', ah((req, res) => {
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  }));
}

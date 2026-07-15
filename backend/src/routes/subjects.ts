import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';
import { newId } from '../util/ids.js';
import { rowToSubject } from '../db.js';
import type { Subject } from '@ace/shared';

export function registerSubjectRoutes(app: Application, db: Db) {
  app.get('/api/subjects', ah((_req, res) => {
    const rows = db.prepare('SELECT * FROM subjects ORDER BY name ASC').all();
    res.json(rows.map(rowToSubject));
  }));

  app.post('/api/subjects', ah(async (req, res) => {
    const s = req.body as Omit<Subject, 'id' | 'createdAt'>;
    if (!s.name || !s.color) { res.status(400).json({ error: 'invalid' }); return; }
    const id = newId('sub');
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO subjects (id, name, color, description, target_hours_per_week, progress, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, s.name, s.color, s.description ?? null, s.targetHoursPerWeek, s.progress, createdAt);
    res.status(201).json(rowToSubject(db.prepare('SELECT * FROM subjects WHERE id = ?').get(id)));
  }));

  app.patch('/api/subjects/:id', ah(async (req, res) => {
    const id = req.params.id;
    const patch = (req.body ?? {}) as Partial<Subject>;
    const existing = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as ReturnType<typeof rowToSubject> | undefined;
    if (!existing) { res.status(404).json({ error: 'not_found' }); return; }
    const merged = { ...existing, ...patch };
    db.prepare(
      `UPDATE subjects SET name=?, color=?, description=?, target_hours_per_week=?, progress=? WHERE id=?`,
    ).run(merged.name, merged.color, merged.description ?? null, merged.targetHoursPerWeek, merged.progress, id);
    res.json(rowToSubject(db.prepare('SELECT * FROM subjects WHERE id = ?').get(id)));
  }));

  app.delete('/api/subjects/:id', ah((req, res) => {
    db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  }));
}

import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';
import { newId } from '../util/ids.js';
import { rowToTask } from '../db.js';
import type { Task } from '@ace/shared';

export function registerTaskRoutes(app: Application, db: Db) {
  app.get('/api/tasks', ah((_req, res) => {
    const rows = db.prepare('SELECT * FROM tasks ORDER BY completed ASC, created_at DESC').all();
    res.json(rows.map(rowToTask));
  }));

  app.post('/api/tasks', ah(async (req, res) => {
    const t = req.body as Omit<Task, 'id' | 'createdAt'>;
    const id = newId('tsk');
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO tasks (id, title, description, priority, due_date, completed, created_at, completed_at, category, subject_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, t.title, t.description ?? null, t.priority,
      t.dueDate ?? null, t.completed ? 1 : 0, createdAt,
      t.completedAt ?? null, t.category ?? null, t.subjectId ?? null,
    );
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.status(201).json(rowToTask(row));
  }));

  app.patch('/api/tasks/:id', ah(async (req, res) => {
    const id = req.params.id;
    const patch = (req.body ?? {}) as Partial<Task>;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as ReturnType<typeof rowToTask> | undefined;
    if (!existing) { res.status(404).json({ error: 'not_found' }); return; }
    const merged = { ...existing, ...patch };
    if (patch.completed === true && !existing.completed) merged.completedAt = new Date().toISOString();
    if (patch.completed === false) merged.completedAt = undefined;
    db.prepare(
      `UPDATE tasks SET title=?, description=?, priority=?, due_date=?, completed=?, completed_at=?, category=?, subject_id=? WHERE id=?`,
    ).run(
      merged.title, merged.description ?? null, merged.priority,
      merged.dueDate ?? null, merged.completed ? 1 : 0, merged.completedAt ?? null,
      merged.category ?? null, merged.subjectId ?? null, id,
    );
    res.json(rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)));
  }));

  app.delete('/api/tasks/:id', ah((req, res) => {
    const id = req.params.id;
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ ok: true });
  }));
}

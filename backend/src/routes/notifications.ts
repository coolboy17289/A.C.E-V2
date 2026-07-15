import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';
import { newId } from '../util/ids.js';
import { rowToNotification } from '../db.js';
import type { NotificationRecord } from '@ace/shared';

export function registerNotificationRoutes(app: Application, db: Db) {
  app.get('/api/notifications', ah((_req, res) => {
    const rows = db.prepare('SELECT * FROM notifications ORDER BY ts DESC LIMIT 100').all();
    res.json(rows.map(rowToNotification));
  }));

  app.patch('/api/notifications/:id', ah(async (req, res) => {
    const id = req.params.id;
    const read = Boolean((req.body ?? {}).read);
    db.prepare('UPDATE notifications SET read = ? WHERE id = ?').run(read ? 1 : 0, id);
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    if (!row) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(rowToNotification(row));
  }));

  // POST is also exposed for the task/focus apps to push new system events.
  app.post('/api/notifications', ah(async (req, res) => {
    const n = req.body as Omit<NotificationRecord, 'id' | 'ts' | 'read'>;
    if (!n.title || !n.message) { res.status(400).json({ error: 'invalid' }); return; }
    const id = newId('ntf');
    const ts = new Date().toISOString();
    db.prepare(`INSERT INTO notifications (id, title, message, ts, read, category) VALUES (?, ?, ?, ?, 0, ?)`)
      .run(id, n.title, n.message, ts, n.category ?? 'system');
    res.status(201).json(rowToNotification(db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)));
  }));
}

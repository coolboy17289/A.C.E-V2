import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';
import type { UserProfile } from '@ace/shared';

interface UserRow {
  id: string;
  name: string;
  avatar: string;
  created_at: string;
  preferences: string;
}

function rowToProfile(r: UserRow): UserProfile {
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    createdAt: r.created_at,
    preferences: JSON.parse(r.preferences),
  };
}

export function registerUserRoutes(app: Application, db: Db) {
  app.get('/api/users/me', ah((_req, res) => {
    const row = db.prepare('SELECT * FROM users LIMIT 1').get() as UserRow | undefined;
    if (!row) {
      // Auto-create the default user if missing (defensive; seed.ts does too).
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO users (id, name, avatar, created_at, preferences)
         VALUES ('user_default', 'Student', '🦊', ?, ?)`,
      ).run(now, JSON.stringify({
        theme: 'dark', accentColor: '#60a5fa', fontScale: 1,
        notificationsEnabled: true, reduceMotion: false, username: 'Student',
      }));
      const row2 = db.prepare('SELECT * FROM users WHERE id = ?').get('user_default') as UserRow;
      return res.json(rowToProfile(row2));
    }
    res.json(rowToProfile(row));
  }));

  app.patch('/api/users/me', ah(async (req, res) => {
    const patch = (req.body ?? {}) as Partial<UserProfile>;
    const row = db.prepare('SELECT * FROM users LIMIT 1').get() as UserRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'no_user' });
      return;
    }
    const prefs = { ...JSON.parse(row.preferences), ...(patch.preferences ?? {}) };
    const next = {
      name: patch.name ?? row.name,
      avatar: patch.avatar ?? row.avatar,
      preferences: JSON.stringify(prefs),
    };
    db.prepare('UPDATE users SET name = ?, avatar = ?, preferences = ? WHERE id = ?')
      .run(next.name, next.avatar, next.preferences, row.id);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id) as UserRow;
    res.json(rowToProfile(updated));
  }));
}

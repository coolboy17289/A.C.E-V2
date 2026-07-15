import {
  seedEvents,
  seedSubjects,
  seedTasks,
} from '@ace/shared';
import type { Db } from './db.js';

/**
 * Seed the database on first boot so the user lands in a populated UI.
 * The seed data is sourced from @ace/shared so the frontend and backend
 * always agree on the default state.
 */
export async function seedIfEmpty(db: Db) {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (userCount.c === 0) {
    db.prepare(
      `INSERT INTO users (id, name, avatar, created_at, preferences)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'user_default',
      'Student',
      '🦊',
      new Date().toISOString(),
      JSON.stringify({
        theme: 'dark',
        accentColor: '#60a5fa',
        fontScale: 1,
        notificationsEnabled: true,
        reduceMotion: false,
        username: 'Student',
      }),
    );
  }

  const subCount = db.prepare('SELECT COUNT(*) as c FROM subjects').get() as { c: number };
  if (subCount.c === 0) {
    const ins = db.prepare(
      `INSERT INTO subjects (id, name, color, description, target_hours_per_week, progress, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const txn = db.transaction((items: typeof seedSubjects) => {
      for (const s of items) {
        ins.run(s.id, s.name, s.color, s.description ?? null, s.targetHoursPerWeek, s.progress, s.createdAt);
      }
    });
    txn(seedSubjects);
  }

  const taskCount = db.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number };
  if (taskCount.c === 0) {
    const ins = db.prepare(
      `INSERT INTO tasks (id, title, description, priority, due_date, completed, created_at, completed_at, category, subject_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const txn = db.transaction((items: typeof seedTasks) => {
      for (const t of items) {
        ins.run(
          t.id, t.title, t.description ?? null, t.priority,
          t.dueDate ?? null, t.completed ? 1 : 0, t.createdAt,
          t.completedAt ?? null, t.category ?? null, t.subjectId ?? null,
        );
      }
    });
    txn(seedTasks);
  }

  const evtCount = db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number };
  if (evtCount.c === 0) {
    const ins = db.prepare(
      `INSERT INTO events (id, title, type, start, end, subject_id, notes, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const txn = db.transaction((items: typeof seedEvents) => {
      for (const e of items) {
        ins.run(
          e.id, e.title, e.type, e.start, e.end,
          e.subjectId ?? null, e.notes ?? null, e.location ?? null,
        );
      }
    });
    txn(seedEvents);
  }

  // Always ensure the settings row exists.
  const settingsCount = db.prepare('SELECT COUNT(*) as c FROM settings_kv').get() as { c: number };
  if (settingsCount.c === 0) {
    db.prepare(`INSERT INTO settings_kv (key, value) VALUES ('app', ?)`).run(
      JSON.stringify({ wifi: '', bluetooth: true, fontScale: 1, theme: 'dark', kiosk: true }),
    );
  }
}

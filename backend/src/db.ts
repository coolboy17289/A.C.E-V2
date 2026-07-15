import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  created_at TEXT NOT NULL,
  preferences TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT,
  target_hours_per_week REAL NOT NULL,
  progress REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL,
  due_date TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  category TEXT,
  subject_id TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  subject_id TEXT,
  notes TEXT,
  location TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_minutes INTEGER NOT NULL,
  break_minutes INTEGER NOT NULL,
  type TEXT NOT NULL,
  subject_id TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  ts TEXT NOT NULL,
  model TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  ts TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks (completed);
CREATE INDEX IF NOT EXISTS idx_events_start ON events (start);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes (subject_id);
`;

/**
 * Opens (and migrates) the SQLite database file. If the file path contains
 * a directory that doesn't exist yet it's created automatically — this is
 * how `ace-core` first boots on the Pi with a clean SD card.
 */
export function openDatabase(file: string): Db {
  const dir = path.dirname(file);
  if (dir && dir !== '.' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function closeDatabase(db: Db) {
  try {
    db.close();
  } catch {
    /* swallow */
  }
}

/* -------------------------------------------------------------------------- */
/* Row mappers                                                                  */
/* -------------------------------------------------------------------------- */

type Raw = Record<string, unknown>;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const rowToTask = (r: Raw) => ({
  id: String(r.id),
  title: String(r.title),
  description: r.description ? String(r.description) : undefined,
  priority: String(r.priority),
  dueDate: r.due_date ? String(r.due_date) : undefined,
  completed: num(r.completed) === 1,
  createdAt: String(r.created_at),
  completedAt: r.completed_at ? String(r.completed_at) : undefined,
  category: r.category ? String(r.category) : undefined,
  subjectId: r.subject_id ? String(r.subject_id) : undefined,
});

export const rowToSubject = (r: Raw) => ({
  id: String(r.id),
  name: String(r.name),
  color: String(r.color),
  description: r.description ? String(r.description) : undefined,
  targetHoursPerWeek: num(r.target_hours_per_week),
  progress: num(r.progress),
  createdAt: String(r.created_at),
});

export const rowToEvent = (r: Raw) => ({
  id: String(r.id),
  title: String(r.title),
  type: String(r.type),
  start: String(r.start),
  end: String(r.end),
  subjectId: r.subject_id ? String(r.subject_id) : undefined,
  notes: r.notes ? String(r.notes) : undefined,
  location: r.location ? String(r.location) : undefined,
});

export const rowToNote = (r: Raw) => ({
  id: String(r.id),
  subjectId: String(r.subject_id),
  title: String(r.title),
  body: String(r.body),
  tags: JSON.parse(String(r.tags ?? '[]')),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
  revisionCount: num(r.revision_count),
});

export const rowToSession = (r: Raw) => ({
  id: String(r.id),
  startedAt: String(r.started_at),
  endedAt: r.ended_at ? String(r.ended_at) : undefined,
  durationMinutes: num(r.duration_minutes),
  breakMinutes: num(r.break_minutes),
  type: String(r.type),
  subjectId: r.subject_id ? String(r.subject_id) : undefined,
  completed: num(r.completed) === 1,
  notes: r.notes ? String(r.notes) : undefined,
});

export const rowToMessage = (r: Raw) => ({
  id: String(r.id),
  role: String(r.role),
  content: String(r.content),
  ts: String(r.ts),
  model: r.model ? String(r.model) : undefined,
});

export const rowToNotification = (r: Raw) => ({
  id: String(r.id),
  title: String(r.title),
  message: String(r.message),
  ts: String(r.ts),
  read: num(r.read) === 1,
  category: String(r.category),
});

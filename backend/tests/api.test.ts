import { describe, it, before, after, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, closeDatabase, type Db } from '../src/db.js';
import { createApp } from '../src/server.js';
import { seedIfEmpty } from '../src/seed.js';

let db: Db;
let app: ReturnType<typeof createApp>;
let tmpFile: string;

before(async () => {
  tmpFile = path.join(os.tmpdir(), `ace-test-${Date.now()}.db`);
  db = openDatabase(tmpFile);
  await seedIfEmpty(db);
  app = createApp({ db });
});

after(() => {
  closeDatabase(db);
  if (fs.existsSync(tmpFile)) fs.rmSync(tmpFile, { force: true });
});

beforeEach(() => {
  // Wipe between tests so state stays predictable.
  db.exec(`
    DELETE FROM tasks; DELETE FROM events; DELETE FROM notes; DELETE FROM sessions;
    DELETE FROM messages; DELETE FROM notifications; DELETE FROM subjects; DELETE FROM users;
    DELETE FROM settings_kv;
  `);
});

describe('health', () => {
  it('responds ok on /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('users', () => {
  it('auto-creates the default profile', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Student');
    expect(res.body.preferences.theme).toBe('dark');
  });

  it('updates preferences and persists the change', async () => {
    await request(app).patch('/api/users/me').send({ name: 'Alex' });
    const res = await request(app).get('/api/users/me');
    expect(res.body.name).toBe('Alex');
  });
});

describe('tasks', () => {
  it('creates, lists, updates and deletes a task', async () => {
    const create = await request(app).post('/api/tasks').send({
      title: 'Read chapter',
      priority: 'medium',
      completed: false,
    });
    expect(create.status).toBe(201);
    expect(create.body.id).toMatch(/^tsk_/);

    const list = await request(app).get('/api/tasks');
    expect(list.body.length).toBe(1);

    const patch = await request(app).patch(`/api/tasks/${create.body.id}`).send({ completed: true });
    expect(patch.body.completed).toBe(true);
    expect(patch.body.completedAt).toBeTruthy();

    const del = await request(app).delete(`/api/tasks/${create.body.id}`);
    expect(del.body.ok).toBe(true);

    const empty = await request(app).get('/api/tasks');
    expect(empty.body.length).toBe(0);
  });
});

describe('calendar', () => {
  it('rejects events without ISO timestamps', async () => {
    const res = await request(app).post('/api/calendar').send({
      title: 'Bad', type: 'event', start: 'friday', end: 'friday',
    });
    expect(res.status).toBe(400);
  });

  it('creates and lists events', async () => {
    const res = await request(app).post('/api/calendar').send({
      title: 'Maths', type: 'class',
      start: new Date().toISOString(), end: new Date(Date.now() + 3600e3).toISOString(),
    });
    expect(res.status).toBe(201);
    const list = await request(app).get('/api/calendar');
    expect(list.body.length).toBe(1);
  });
});

describe('subjects + notes', () => {
  it('CRUD roundtrip', async () => {
    const s = await request(app).post('/api/subjects').send({
      name: 'Maths', color: '#60a5fa', targetHoursPerWeek: 5, progress: 0.2,
    });
    expect(s.status).toBe(201);

    const n = await request(app).post('/api/notes').send({
      subjectId: s.body.id, title: 'Integration', body: '...', tags: ['unit-test'],
    });
    expect(n.status).toBe(201);
    expect(n.body.revisionCount).toBe(0);

    const edited = await request(app).patch(`/api/notes/${n.body.id}`).send({ body: 'edited' });
    expect(edited.body.revisionCount).toBe(1);
  });
});

describe('focus sessions', () => {
  it('records a Pomodoro with default-ish fields', async () => {
    const res = await request(app).post('/api/focus').send({
      startedAt: new Date().toISOString(),
      durationMinutes: 25, breakMinutes: 5, type: 'pomodoro',
      completed: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('pomodoro');

    const list = await request(app).get('/api/focus');
    expect(list.body.length).toBe(1);
  });
});

describe('AI chat', () => {
  it('persists a user message and returns an assistant reply', async () => {
    const res = await request(app).post('/api/ai/messages').send({ content: 'How do I study physics?' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('assistant');
    expect(res.body.content.length).toBeGreaterThan(0);

    const list = await request(app).get('/api/ai/messages');
    expect(list.body.length).toBe(2);
  });

  it('reset clears the history', async () => {
    await request(app).post('/api/ai/messages').send({ content: 'Hi' });
    await request(app).post('/api/ai/reset').expect(200);
    const list = await request(app).get('/api/ai/messages');
    expect(list.body.length).toBe(0);
  });
});

describe('notifications', () => {
  it('push + read', async () => {
    const res = await request(app).post('/api/notifications').send({
      title: 'Task due', message: 'Calc problem set due tomorrow', category: 'reminder',
    });
    expect(res.status).toBe(201);
    const id = res.body.id;
    const patch = await request(app).patch(`/api/notifications/${id}`).send({ read: true });
    expect(patch.body.read).toBe(true);
  });
});

describe('settings', () => {
  it('round-trips a settings object', async () => {
    await request(app).put('/api/settings').send({ wifi: 'home-5g', bluetooth: true });
    const res = await request(app).get('/api/settings');
    expect(res.body.wifi).toBe('home-5g');
    expect(res.body.bluetooth).toBe(true);
  });
});

describe('hardware & system', () => {
  it('returns DeviceInfo with sensible keys', async () => {
    const res = await request(app).get('/api/hardware/device');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hostname');
    expect(res.body).toHaveProperty('memory');
  });

  it('rejects out-of-range pins', async () => {
    const bad = await request(app).post('/api/hardware/led').send({ pin: 99, on: true });
    expect(bad.status).toBe(400);
  });

  it('accepts in-range pins and reports mode', async () => {
    const res = await request(app).post('/api/hardware/led').send({ pin: 17, on: true });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBeOneOf?.(['real', 'stub']) ?? expect(['real','stub']).toContain(res.body.mode);
  });

  it('shutdown + restart are non-throwing in dev', async () => {
    const s = await request(app).post('/api/system/shutdown');
    expect(s.status).toBe(200);
    const r = await request(app).post('/api/system/restart');
    expect(r.status).toBe(200);
  });
});

import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';
import { newId } from '../util/ids.js';
import { rowToMessage } from '../db.js';
import { ask, describeImageWithFallback } from '../services/ai.js';
import type { ChatMessage } from '@ace/shared';

const HISTORY_LIMIT = 200;

export function registerAiRoutes(app: Application, _db: Db) {
  // Note: _db is reserved for future conversation index tables.

  app.get('/api/ai/messages', ah((_req, res) => {
    // In-process k/v would be the long-term store for chat history but
    // we deliberately persist only on /messages POST so the table mirrors
    // the conversation accurately.
    const rows = _db
      .prepare('SELECT * FROM messages ORDER BY ts ASC LIMIT ?')
      .all(HISTORY_LIMIT);
    res.json(rows.map(rowToMessage));
  }));

  app.post('/api/ai/messages', ah(async (req, res) => {
    const content = String((req.body ?? {}).content ?? '').trim();
    if (!content) { res.status(400).json({ error: 'empty_message' }); return; }

    const userMsg: ChatMessage = {
      id: newId('msg'),
      role: 'user',
      content,
      ts: new Date().toISOString(),
    };
    _db.prepare(`INSERT INTO messages (id, role, content, ts, model) VALUES (?, ?, ?, ?, ?)`)
      .run(userMsg.id, 'user', content, userMsg.ts, null);

    const sentences = _db
      .prepare('SELECT * FROM messages ORDER BY ts ASC LIMIT ?')
      .all(HISTORY_LIMIT) as ReturnType<typeof rowToMessage>[];
    const result = await ask({ prompt: content, history: sentences });
    _db.prepare(`INSERT INTO messages (id, role, content, ts, model) VALUES (?, ?, ?, ?, ?)`)
      .run(result.message.id, 'assistant', result.message.content, result.message.ts, result.message.model ?? null);

    res.json({ ...result.message, remote: result.remote, error: result.error });
  }));

  app.post('/api/ai/vision', ah(async (req, res) => {
    const prompt = String((req.body ?? {}).prompt ?? '').trim() || 'Describe what you see.';
    const result = await describeImageWithFallback(prompt);
    _db.prepare(`INSERT INTO messages (id, role, content, ts, model) VALUES (?, ?, ?, ?, ?)`)
      .run(result.message.id, 'assistant', result.message.content, result.message.ts, result.message.model ?? null);
    res.json(result.message);
  }));

  app.post('/api/ai/reset', ah((_req, res) => {
    _db.prepare('DELETE FROM messages').run();
    res.json({ ok: true });
  }));
}

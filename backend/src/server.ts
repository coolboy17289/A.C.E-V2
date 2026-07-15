import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Db } from './db.js';

import { registerUserRoutes } from './routes/users.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerCalendarRoutes } from './routes/calendar.js';
import { registerSubjectRoutes } from './routes/subjects.js';
import { registerNoteRoutes } from './routes/notes.js';
import { registerFocusRoutes } from './routes/focus.js';
import { registerAiRoutes } from './routes/ai.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerHardwareRoutes } from './routes/hardware.js';
import { registerSystemRoutes } from './routes/system.js';

/**
 * Creates a fresh Express app with every A.C.E route mounted. We take the
 * SQLite handle as a dependency so tests can swap in a fresh in-memory DB.
 */
export function createApp({ db }: { db: Db }): Application {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ace-backend', ts: new Date().toISOString() });
  });

  registerUserRoutes(app, db);
  registerTaskRoutes(app, db);
  registerCalendarRoutes(app, db);
  registerSubjectRoutes(app, db);
  registerNoteRoutes(app, db);
  registerFocusRoutes(app, db);
  registerNotificationRoutes(app, db);
  registerSettingsRoutes(app, db);
  registerHardwareRoutes(app, db);
  registerSystemRoutes(app, db);
  registerAiRoutes(app, db);

  // In production the backend also serves the React shell. Vite outputs
  // everything into ../frontend/desktop-shell/dist - we look there first.
  const candidates = [
    path.resolve(process.cwd(), 'frontend/desktop-shell/dist'),
    path.resolve(process.cwd(), '../frontend/desktop-shell/dist'),
    path.resolve(fileURLToPath(import.meta.url), '../../frontend/desktop-shell/dist'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      app.use(express.static(dir));
      app.get('*', (_req, res) => res.sendFile(path.join(dir, 'index.html')));
      break;
    }
  }

  // 404 for unknown /api routes
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // Final error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('[ace-backend] unhandled error', err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  });

  return app;
}

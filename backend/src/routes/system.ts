import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';
import { shutdown, restart } from '../services/system.js';

export function registerSystemRoutes(app: Application, _db: Db) {
  app.post('/api/system/shutdown', ah(async (_req, res) => {
    const result = await shutdown();
    res.json(result);
  }));
  app.post('/api/system/restart', ah(async (_req, res) => {
    const result = await restart();
    res.json(result);
  }));
}

import { createServer } from 'node:http';
import { createApp } from './server.js';
import { openDatabase, closeDatabase } from './db.js';
import { seedIfEmpty } from './seed.js';
import { startDeviceMonitor } from './services/hardware.js';

const PORT = Number(process.env.ACE_PORT ?? 4317);
const DB_PATH = process.env.ACE_DB_PATH ?? './data/ace.db';

async function main() {
  const db = openDatabase(DB_PATH);
  await seedIfEmpty(db);

  const app = createApp({ db });
  const server = createServer(app);

  // Background poller that refreshes DeviceInfo on the bus every 5s. The
  // /api/hardware/device route reads from the in-memory snapshot, so the
  // frontend never blocks while we read /sys or /proc.
  startDeviceMonitor(db, 5_000);

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[ace-backend] listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[ace-backend] ${signal} received, draining…`);
    server.close(() => {
      closeDatabase(db);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[ace-backend] fatal startup error', err);
  process.exit(1);
});

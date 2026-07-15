import React from 'react';
import { createRoot } from 'react-dom/client';
import { configureClient } from '@ace/shared';
import { App } from './App';
import './styles.css';

// Side-effect-only import: scans `public/backgrounds/*.{png,...}` at
// build/dev time via `import.meta.glob` and pushes the resulting preset
// list into the aceStore. Must run before `<App />` so Settings renders
// with the merged preset list already populated.
import './backgrounds-bridge';

// In a deployed A.C.E image the desktop shell is served by the ace-core
// service on port 4317. In dev the backend runs on 4317 too, so this is
// the only sensible default. On the Pi the bundled files are static and
// Chromium simply hits /api/* on the same origin served by the backend.
configureClient('/api');

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

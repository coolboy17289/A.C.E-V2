import type { ReactNode } from 'react';

export const metadata = {
  title: 'A.C.E OS — Next.js shell',
  description: 'Alternative front-end targeting the A.C.E Express backend.',
};

/**
 * Minimal root layout. Inherits Next's default <html>/<body> rendering
 * (Next.js 13+ App Router requires a root layout that emits both).
 * Kept intentionally bare — this shell is an MVP proof of plumbing,
 * not a styled clone of the React dashboard.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          background:
            'radial-gradient(1200px 600px at 0% 0%, #1f2a44, #0b1020 60%)',
          color: '#e8eaf3',
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}

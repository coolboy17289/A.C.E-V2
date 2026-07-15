import { exec } from 'node:child_process';

const REAL_POWER = process.env.ACE_ALLOW_POWER === 'true' || process.env.ACE_HARDWARE === 'real';

export interface PowerResult {
  ok: true;
  action: 'shutdown' | 'restart';
  /** False when the action was logged but never executed (dev laptop, tests). */
  executed: boolean;
}

/**
 * In production on a Pi this shells out to systemctl. In dev it just
 * logs the intent. Either way the HTTP route replies immediately so the
 * UI doesn't hang.
 */
export function shutdown(): Promise<PowerResult> {
  return doPower('shutdown', 'systemctl poweroff || sudo /sbin/shutdown -h now');
}

export function restart(): Promise<PowerResult> {
  return doPower('restart', 'systemctl reboot || sudo /sbin/shutdown -r now');
}

function doPower(action: 'shutdown' | 'restart', cmd: string): Promise<PowerResult> {
  if (!REAL_POWER) {
    // eslint-disable-next-line no-console
    console.log(`[ace-system:stub] would ${action} (${cmd})`);
    return Promise.resolve({ ok: true, action, executed: false });
  }
  return new Promise((resolve) => {
    exec(cmd, (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.warn(`[ace-system] ${action} failed`, err);
      }
      resolve({ ok: true, action, executed: !err });
    });
  });
}

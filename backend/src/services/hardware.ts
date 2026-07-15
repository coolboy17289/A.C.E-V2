import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type { DeviceInfo } from '@ace/shared';
import type { Db } from '../db.js';

/**
 * Live device telemetry, refreshed in the background. The HTTP route
 * `/api/hardware/device` returns the most recent snapshot so the shell
 * can poll politely without us hammering /sys on every tap.
 */

let current: DeviceInfo | null = null;

const DEFAULT_DEVICE: DeviceInfo = {
  hostname: os.hostname(),
  model: 'unknown',
  cpuTempC: 0,
  memory: { totalMb: 0, usedMb: 0, freeMb: 0 },
  storage: { totalGb: 0, usedGb: 0 },
  ip: '',
  uptimeSeconds: 0,
  kernel: '',
};

interface ReadResult extends DeviceInfo {}

function safeReadFile(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function detectModel(): 'rpi4' | 'rpi5' | 'unknown' {
  const model = safeReadFile('/proc/device-tree/model');
  if (model) {
    const m = model.toLowerCase();
    if (m.includes('raspberry pi 5')) return 'rpi5';
    if (m.includes('raspberry pi 4')) return 'rpi4';
    if (m.includes('raspberry pi')) return 'rpi4'; // best-guess fallback
  }
  const cpuinfo = safeReadFile('/proc/cpuinfo') ?? '';
  if (/Raspberry Pi/.test(cpuinfo)) {
    return /Pi 5/.test(cpuinfo) ? 'rpi5' : 'rpi4';
  }
  return 'unknown';
}

function readCpuTemp(): number {
  // Pi: /sys/class/thermal/thermal_zone0/temp reports millidegrees Celsius.
  const v = safeReadFile('/sys/class/thermal/thermal_zone0/temp');
  if (v) return Number(v.trim()) / 1000;

  // Generic Linux: scan hwmon for a `temp*_input` value.
  const hwmon = '/sys/class/hwmon';
  if (fs.existsSync(hwmon)) {
    try {
      const chips = fs.readdirSync(hwmon);
      for (const c of chips) {
        const files = fs.readdirSync(path.join(hwmon, c));
        const t = files.find((f) => /^temp\d+_input$/.test(f));
        if (t) {
          const raw = safeReadFile(path.join(hwmon, c, t));
          if (raw) return Number(raw.trim()) / 1000;
        }
      }
    } catch { /* ignore */ }
  }
  return 0;
}

function readMemory() {
  const raw = safeReadFile('/proc/meminfo') ?? '';
  const grab = (key: string): number => {
    const m = raw.match(new RegExp(`${key}:\\s+(\\d+)`));
    return m ? Number(m[1]) / 1024 : 0; // kB -> MB
  };
  const total = grab('MemTotal');
  const free = grab('MemAvailable') || grab('MemFree');
  const used = Math.max(0, total - free);
  return { totalMb: Math.round(total), usedMb: Math.round(used), freeMb: Math.round(free) };
}

function readStorage() {
  try {
    const stats = fs.statfsSync('/');
    const totalBytes = stats.bsize * stats.blocks;
    const freeBytes = stats.bsize * stats.bavail;
    const usedBytes = totalBytes - freeBytes;
    return {
      totalGb: Number((totalBytes / 1024 ** 3).toFixed(2)),
      usedGb: Number((usedBytes / 1024 ** 3).toFixed(2)),
    };
  } catch {
    return { totalGb: 0, usedGb: 0 };
  }
}

function readIp(): string {
  const ifaces = os.networkInterfaces();
  const candidates = ['wlan0', 'eth0', 'en0', 'wlp2s0', 'enp0s3'];
  for (const name of candidates) {
    const list = ifaces[name];
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '0.0.0.0';
}

function readUptime(): number {
  const raw = safeReadFile('/proc/uptime');
  if (raw) return Number(raw.split(' ')[0]) || 0;
  return os.uptime();
}

function readKernel(): string {
  const uname = safeReadFile('/proc/version');
  if (uname) return uname.replace('Linux version ', '').split(' ')[0];
  return os.release();
}

function readNow(): ReadResult {
  return {
    hostname: os.hostname(),
    model: detectModel(),
    cpuTempC: Math.round(readCpuTemp() * 10) / 10,
    memory: readMemory(),
    storage: readStorage(),
    ip: readIp(),
    uptimeSeconds: Math.round(readUptime()),
    kernel: readKernel(),
  };
}

/** Returns the most recent snapshot. Re-reads on first call. */
export function snapshot(): DeviceInfo {
  if (!current) current = readNow();
  return current;
}

/**
 * Periodically refreshes the snapshot. The DB handle is reserved so we can
 * later push telemetry events into a `hw_events` table without changing
 * the route shape.
 */
export function startDeviceMonitor(_db: Db, intervalMs: number) {
  current = readNow();
  const t = setInterval(() => {
    try {
      current = readNow();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[ace-hardware] snapshot failed', err);
    }
  }, Math.max(1000, intervalMs));
  t.unref();
  // Touch the default so eslint doesn't complain about unused destructuring.
  void DEFAULT_DEVICE;
}

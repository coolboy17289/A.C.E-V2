import React, { useEffect, useState } from 'react';
import {
  api,
  classNames,
  useAceStore,
  type DeviceInfo,
  type UserProfile,
} from '@ace/shared';

/**
 * A.C.E Settings - profile, system controls, network, device info and a
 * pair of soft-shutdown buttons. Everything routes through the /api
 * layer so the backend is the single source of truth.
 */
const SettingsApp: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [wifi, setWifi] = useState('');
  const [kiosk, setKiosk] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [accent, setAccent] = useState('#60a5fa');
  const [username, setUsername] = useState('Student');
  const [avatar, setAvatar] = useState('🦊');
  const [busy, setBusy] = useState(false);
  const setUserStore = useAceStore((s) => s.setUser);
  const setPrefs = useAceStore((s) => s.setPreferences);
  const toast = useAceStore((s) => s.toast);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const me = await api.getUser();
      setUser(me);
      setUsername(me.preferences.username ?? me.name);
      setAvatar(me.avatar);
      setReduceMotion(me.preferences.reduceMotion);
      setFontScale(me.preferences.fontScale);
      setAccent(me.preferences.accentColor);

      const [dev, settings] = await Promise.all([
        api.getDevice(),
        api.getSettings(),
      ]);
      setDevice(dev);
      const s = settings as { app?: { wifi?: string; kiosk?: boolean } };
      setWifi(typeof s.app?.wifi === 'string' ? s.app.wifi : '');
      setKiosk(s.app?.kiosk !== false);
    } catch (e) {
      void e;
    }
  }

  async function savePrefs() {
    if (!user) return;
    setBusy(true);
    try {
      const next = await api.updateUser({ name: username, avatar });
      setUser(next);
      setPrefs({
        username, avatar, accentColor: accent, fontScale,
        reduceMotion, notificationsEnabled: true, theme: 'dark',
      });
      setUserStore(username, avatar);
      await api.saveSettings({ app: { wifi, kiosk, fontScale, theme: 'dark' }, accent, reduceMotion });
      toast({ title: 'Settings saved', body: 'Preferences updated.', variant: 'success' });
    } finally { setBusy(false); }
  }

  async function shutdown(restart: boolean) {
    try {
      if (restart) await api.triggerRestart();
      else await api.triggerShutdown();
      toast({ title: restart ? 'Restarting…' : 'Shutting down…', body: 'See you in a moment.', variant: 'info' });
    } catch (e) {
      toast({ title: 'Failed', body: String((e as Error).message), variant: 'error' });
    }
  }

  async function blink() {
    try {
      await api.setLed(17, true);
      await new Promise((r) => setTimeout(r, 600));
      await api.setLed(17, false);
      toast({ title: 'LED blink', body: 'GPIO 17 toggled.', variant: 'success' });
    } catch (e) {
      toast({ title: 'LED error', body: String((e as Error).message), variant: 'error' });
    }
  }

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-xs text-ace-muted">Tailor A.C.E OS to your device.</p>
      </header>

      <section className="ace-card space-y-3">
        <h2 className="font-semibold">Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl"
              style={{ background: 'linear-gradient(135deg,#60a5fa,#a78bfa)' }}
            >
              {avatar}
            </div>
            <input className="ace-input text-center" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-ace-muted">Display name
              <input className="ace-input" value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="text-xs text-ace-muted">Accent color
              <input type="color" className="ace-input h-10 p-1" value={accent} onChange={(e) => setAccent(e.target.value)} />
            </label>
            <label className="text-xs text-ace-muted">Font scale: {fontScale.toFixed(2)}x
              <input type="range" min={1} max={1.5} step={0.05} value={fontScale} onChange={(e) => setFontScale(Number(e.target.value))} />
            </label>
            <label className="text-xs text-ace-muted flex items-center gap-2 mt-6">
              <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} />
              Reduce motion
            </label>
          </div>
        </div>
        <button className="ace-btn-primary" disabled={busy} onClick={savePrefs}>{busy ? 'Saving…' : 'Save profile'}</button>
      </section>

      <section className="ace-card grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <h2 className="font-semibold mb-2">Network</h2>
          <label className="text-xs text-ace-muted">Wi-Fi SSID
            <input className="ace-input" value={wifi} onChange={(e) => setWifi(e.target.value)} placeholder="home-5g" />
          </label>
          <label className="text-xs text-ace-muted flex items-center gap-2 mt-3">
            <input type="checkbox" checked={kiosk} onChange={(e) => setKiosk(e.target.checked)} />
            Lock to kiosk mode (exit only from this app)
          </label>
          <button className="ace-btn mt-3" disabled={busy} onClick={savePrefs}>Save network</button>
        </div>
        <div>
          <h2 className="font-semibold mb-2">Device</h2>
          {device ? (
            <dl className="text-sm grid grid-cols-[120px_1fr] gap-y-1">
              <dt className="text-ace-muted">Hostname</dt><dd>{device.hostname}</dd>
              <dt className="text-ace-muted">Model</dt><dd>{device.model.toUpperCase()}</dd>
              <dt className="text-ace-muted">CPU</dt><dd>{device.cpuTempC}°C</dd>
              <dt className="text-ace-muted">Memory</dt>
              <dd>{device.memory.usedMb} / {device.memory.totalMb} MB</dd>
              <dt className="text-ace-muted">Storage</dt>
              <dd>{device.storage.usedGb} / {device.storage.totalGb} GB</dd>
              <dt className="text-ace-muted">IP</dt><dd>{device.ip}</dd>
              <dt className="text-ace-muted">Uptime</dt>
              <dd>{Math.floor(device.uptimeSeconds / 3600)}h {Math.floor((device.uptimeSeconds % 3600) / 60)}m</dd>
              <dt className="text-ace-muted">Kernel</dt><dd className="truncate">{device.kernel}</dd>
            </dl>
          ) : <p className="text-sm text-ace-muted">Loading…</p>}
          <button className="ace-btn mt-3" onClick={load}>Refresh</button>
        </div>
      </section>

      <section className="ace-card space-y-2">
        <h2 className="font-semibold">System</h2>
        <div className="flex flex-wrap gap-2">
          <button className="ace-btn" onClick={blink}>Blink GPIO 17</button>
          <button className="ace-btn" onClick={() => shutdown(false)}>Power off</button>
          <button className="ace-btn-danger" onClick={() => shutdown(true)}>Restart</button>
        </div>
        <p className="text-xs text-ace-muted">
          Power actions are <em>stubbed</em> in development. On a real Pi image set
          <code className="ml-1 px-1 py-0.5 rounded bg-black/30">ACE_ALLOW_POWER=true</code> to enable them.
        </p>
      </section>

      <section className={classNames('ace-card text-xs text-ace-muted space-y-1')}>
        <div>API: {typeof window !== 'undefined' ? window.location.origin : 'kiosk'}</div>
        <div>Build: {user?.createdAt ? new Date(user.createdAt).toISOString().slice(0,10) : '—'}</div>
      </section>
    </div>
  );
};

export default SettingsApp;

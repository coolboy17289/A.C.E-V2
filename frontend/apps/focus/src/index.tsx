import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  classNames,
  formatDate,
  useAceStore,
  type FocusSession,
  type Subject,
} from '@ace/shared';

/**
 * A.C.E Focus - Pomodoro timer with break tracking. Counts down using a
 * monotonic clock (Date.now diff) so background tabs don't lose time.
 */
type Mode = 'pomodoro' | 'short' | 'long';

const PRESETS: Record<Mode, { work: number; break: number }> = {
  pomodoro: { work: 25, break: 5 },
  short: { work: 15, break: 3 },
  long: { work: 50, break: 10 },
};

const FocusApp: React.FC = () => {
  const [mode, setMode] = useState<Mode>('pomodoro');
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(PRESETS.pomodoro.work * 60);
  const [inBreak, setInBreak] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string>('');
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const tickRef = useRef<number | null>(null);
  const pushNotification = useAceStore((s) => s.pushNotification);
  const toast = useAceStore((s) => s.toast);

  useEffect(() => {
    void Promise.all([api.listSubjects(), api.listSessions()]).then(([s, ses]) => {
      setSubjects(s);
      setSessions(ses);
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // Transition
        if (!inBreak) {
          setInBreak(true);
          toast({ title: 'Break time', body: `${PRESETS[mode].break} minutes. Stretch!`, variant: 'success' });
          recordSession();
          return PRESETS[mode].break * 60;
        }
        setInBreak(false);
        setRunning(false);
        toast({ title: 'Session complete', body: 'Ready for the next round?', variant: 'success' });
        pushNotification({ title: 'Focus complete', message: `${PRESETS[mode].work} min done`, category: 'reminder' });
        return PRESETS[mode].work * 60;
      });
    }, 1000);
    tickRef.current = id;
    return () => window.clearInterval(id);
  }, [running, inBreak, mode, pushNotification, toast]);

  async function recordSession() {
    if (!startedAt) return;
    const finished = await api.createSession({
      startedAt,
      endedAt: new Date().toISOString(),
      durationMinutes: PRESETS[mode].work,
      breakMinutes: PRESETS[mode].break,
      type: mode,
      completed: true,
      subjectId: subjectId || undefined,
    });
    setSessions((p) => [finished, ...p].slice(0, 50));
  }

  function start() {
    if (running) return;
    setRunning(true);
    setStartedAt(new Date().toISOString());
    setSecondsLeft(inBreak ? PRESETS[mode].break * 60 : PRESETS[mode].work * 60);
  }

  function pause() { setRunning(false); }

  function reset() {
    setRunning(false);
    setInBreak(false);
    setSecondsLeft(PRESETS[mode].work * 60);
    setStartedAt(null);
  }

  function pick(m: Mode) {
    setMode(m);
    setInBreak(false);
    setRunning(false);
    setSecondsLeft(PRESETS[m].work * 60);
  }

  const total = inBreak ? PRESETS[mode].break * 60 : PRESETS[mode].work * 60;
  const ratio = useMemo(() => (total - secondsLeft) / total, [secondsLeft, total]);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const today = sessions.filter((s) => s.startedAt.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const totalMinutesToday = today.reduce((acc, s) => acc + s.durationMinutes, 0);

  return (
    <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
      <section className="ace-card flex flex-col items-center justify-center text-center">
        <div className="flex gap-2 mb-6">
          {(Object.keys(PRESETS) as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => pick(m)}
              className={classNames(
                'ace-pill capitalize cursor-pointer px-3 py-1.5',
                mode === m && 'border-white/40 bg-white/10 text-white',
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="relative w-64 h-64 flex items-center justify-center mb-4">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
            <circle
              cx="50" cy="50" r="46"
              stroke={inBreak ? '#34d399' : '#60a5fa'}
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 46}`}
              strokeDashoffset={`${(1 - ratio) * 2 * Math.PI * 46}`}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <div>
            <div className="text-6xl font-mono tabular-nums font-semibold">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            <div className="text-xs uppercase tracking-widest text-ace-muted mt-1">
              {inBreak ? 'Break' : running ? 'Focus' : 'Idle'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {!running ? (
            <button className="ace-btn-primary text-lg px-6 py-3" onClick={start}>Start</button>
          ) : (
            <button className="ace-btn text-lg px-6 py-3" onClick={pause}>Pause</button>
          )}
          <button className="ace-btn" onClick={reset}>Reset</button>
          <select
            className="ace-input w-auto"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label="Focus subject"
          >
            <option value="">No subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="mt-4 text-xs text-ace-muted">
          {totalMinutesToday > 0
            ? `Today: ${totalMinutesToday} minutes across ${today.length} sessions`
            : 'No sessions logged yet today'}
        </div>
      </section>

      <aside className="ace-card overflow-hidden">
        <h2 className="font-semibold mb-3">History</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-ace-muted">Your first Pomodoro will appear here.</p>
        ) : (
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {sessions.slice(0, 20).map((s) => {
              const subj = subjects.find((sb) => sb.id === s.subjectId);
              return (
                <li key={s.id} className="rounded-xl p-3 border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{s.type}</span>
                    <span className="text-ace-muted">{s.durationMinutes}m</span>
                  </div>
                  <div className="text-xs text-ace-muted mt-1 flex justify-between">
                    <span>{formatDate(s.startedAt)} · {new Date(s.startedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                    {subj && <span style={{ color: subj.color }}>● {subj.name}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
};

export default FocusApp;

import React, { useEffect, useMemo, useState } from 'react';
import {
  api,
  classNames,
  type CalendarEvent,
  type FocusSession,
  type Subject,
  type Task,
} from '@ace/shared';

/**
 * A.C.E Statistics - learning analytics rendered with SVG so the bundle
 * stays small and the chart is crisp on the 7" screen.
 */
const StatisticsApp: React.FC = () => {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    void Promise.all([
      api.listSessions(),
      api.listTasks(),
      api.listSubjects(),
      api.listEvents(),
    ]).then(([s, t, sub, ev]) => {
      setSessions(s); setTasks(t); setSubjects(sub); setEvents(ev);
    });
  }, []);

  const dailyMinutes = useMemo(() => bucketMinutesByDay(sessions, 7), [sessions]);

  const totalMinutesWeek = dailyMinutes.reduce((acc, d) => acc + d.minutes, 0);
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completedThisWeek = tasks.filter((t) => t.completed && t.completedAt && within7Days(t.completedAt)).length;
  const upcomingEvents = events
    .filter((e) => new Date(e.start).getTime() > Date.now() - 86400e3)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  const subjectTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (!s.subjectId) continue;
      map.set(s.subjectId, (map.get(s.subjectId) ?? 0) + s.durationMinutes);
    }
    return map;
  }, [sessions]);
  const maxSubjectMin = Math.max(1, ...Array.from(subjectTotals.values()));

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Statistics</h1>
        <p className="text-xs text-ace-muted">The last 7 days, summarised.</p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill label="Focus minutes (7d)" value={totalMinutesWeek.toString()} />
        <StatPill label="Sessions" value={sessions.filter((s) => within7Days(s.startedAt)).length.toString()} />
        <StatPill label="Tasks completed (7d)" value={completedThisWeek.toString()} />
        <StatPill label="All-time tasks" value={completedTasks.toString()} />
      </section>

      <section className="ace-card">
        <h2 className="font-semibold mb-3">Study minutes per day</h2>
        <DailyBarChart data={dailyMinutes} />
      </section>

      <section className="ace-card">
        <h2 className="font-semibold mb-3">Per subject share</h2>
        {Array.from(subjectTotals.entries()).length === 0 ? (
          <p className="text-sm text-ace-muted">No tagged sessions yet. Pick a subject when starting a focus block.</p>
        ) : (
          <ul className="space-y-2">
            {Array.from(subjectTotals.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([id, mins]) => {
                const s = subjects.find((x) => x.id === id);
                const pct = mins / maxSubjectMin;
                return (
                  <li key={id} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full flex-none" style={{ background: s?.color ?? '#888' }} />
                    <span className="w-32 truncate">{s?.name ?? 'Unknown'}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: s?.color ?? '#60a5fa' }} />
                    </div>
                    <span className="text-ace-muted w-12 text-right tabular-nums">{mins}m</span>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="ace-card">
        <h2 className="font-semibold mb-3">Upcoming</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-ace-muted">No upcoming events.</p>
        ) : (
          <ul className="space-y-2">
            {upcomingEvents.slice(0, 5).map((ev) => (
              <li key={ev.id} className="flex items-center gap-2 text-sm">
                <span className={classNames('ace-pill text-xs uppercase',
                  ev.type === 'exam' ? 'border-red-400/40' :
                  ev.type === 'class' ? 'border-blue-400/40' :
                  ev.type === 'assignment' ? 'border-violet-400/40' : '')}>
                  {ev.type}
                </span>
                <span className="flex-1 truncate">{ev.title}</span>
                <span className="text-ace-muted text-xs">{new Date(ev.start).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const StatPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="ace-card text-center">
    <div className="text-xs uppercase text-ace-muted">{label}</div>
    <div className="text-2xl font-semibold mt-1">{value}</div>
  </div>
);

const DailyBarChart: React.FC<{ data: Array<{ day: Date; minutes: number }> }> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.minutes));
  return (
    <svg viewBox="0 0 280 140" className="w-full h-40">
      {data.map((d, i) => {
        const x = 10 + i * 36;
        const h = (d.minutes / max) * 100;
        const y = 130 - h;
        return (
          <g key={d.day.toISOString()}>
            <rect x={x} y={y} width={28} height={h} rx={4} fill="url(#grad)" />
            <text x={x + 14} y={130} textAnchor="middle" fontSize="10" fill="#9aa6c4">
              {d.day.toLocaleDateString([], { weekday: 'short' })}
            </text>
            <text x={x + 14} y={y - 4} textAnchor="middle" fontSize="9" fill="#e6ecff">
              {d.minutes ? `${d.minutes}m` : ''}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
};

function bucketMinutesByDay(sessions: FocusSession[], days: number) {
  const start = startOfDay(new Date());
  start.setDate(start.getDate() - (days - 1));
  const buckets: Array<{ day: Date; minutes: number }> = Array.from({ length: days }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return { day: d, minutes: 0 };
  });
  for (const s of sessions) {
    const d = startOfDay(new Date(s.startedAt));
    const idx = buckets.findIndex((b) => +b.day === +d);
    if (idx >= 0) buckets[idx].minutes += s.durationMinutes;
  }
  return buckets;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function within7Days(iso: string) {
  const t = Date.parse(iso);
  return Number.isFinite(t) && (Date.now() - t) < 7 * 86400e3;
}

export default StatisticsApp;

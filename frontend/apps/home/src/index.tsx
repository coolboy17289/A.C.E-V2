import React, { useEffect, useState } from 'react';
import {
  api,
  classNames,
  formatTime,
  relativeFromNow,
  useAceStore,
  type CalendarEvent,
  type Subject,
  type Task,
} from '@ace/shared';

/**
 * A.C.E Home - daily dashboard. Everything here is read-only and computed
 * client-side over the cached API responses, so opening Home is instant
 * even on the 7" Pi.
 */
const HomeApp: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const username = useAceStore((s) => s.username);
  const avatar = useAceStore((s) => s.avatar);
  const openApp = useAceStore((s) => s.openApp);
  const pushNotification = useAceStore((s) => s.pushNotification);

  useEffect(() => {
    void Promise.allSettled([api.listEvents(), api.listTasks(), api.listSubjects()]).then(
      ([e, t, s]) => {
        if (e.status === 'fulfilled') setEvents(e.value);
        if (t.status === 'fulfilled') setTasks(t.value);
        if (s.status === 'fulfilled') setSubjects(s.value);
      },
    );
  }, []);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const today = events
    .filter((ev) => sameDay(new Date(ev.start), now))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const open = tasks.filter((t) => !t.completed);
  const nextUp = open[0];
  const completedToday = tasks.filter(
    (t) => t.completed && t.completedAt && sameDay(new Date(t.completedAt), now),
  );

  const averageProgress =
    subjects.length === 0
      ? 0
      : subjects.reduce((acc, s) => acc + (s.progress ?? 0), 0) / subjects.length;

  return (
    <div className="p-5 sm:p-6 space-y-5 text-ace-ink">
      <header className="flex flex-wrap items-end gap-支援3 justify-between">
        <div>
          <div className="text-sm text-ace-muted">{greeting},</div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <span aria-hidden className="text-3xl">{avatar}</span>
            {username}
          </h1>
        </div>
        <div className="flex gap-2">
          <button className="ace-btn" onClick={() => openApp('tasks')}>＋ Task</button>
          <button className="ace-btn" onClick={() => openApp('focus')}>▶ Focus</button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Today" value={`${today.length} events`} accent="#60a5fa" />
        <StatCard
          label="Open tasks"
          value={`${open.length}`}
          hint={nextUp ? `Next: ${nextUp.title}` : 'All clear'}
          accent="#a78bfa"
        />
        <StatCard
          label="Completed"
          value={`${completedToday.length}`}
          hint={completedToday.length ? 'Nice momentum 🦊' : 'Let’s get one done'}
          accent="#34d399"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <div className="ace-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Today’s schedule</h2>
            <button className="text-xs text-ace-muted hover:text-white" onClick={() => openApp('planner')}>
              Open Planner →
            </button>
          </div>
          {today.length === 0 ? (
            <p className="text-sm text-ace-muted">No events today. Quiet day 🌱</p>
          ) : (
            <ul className="space-y-2">
              {today.slice(0, 6).map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                  <div
                    className="w-1.5 h-10 rounded-full"
                    style={{
                      background:
                        ev.type === 'exam' ? '#f87171' :
                        ev.type === 'class' ? '#60a5fa' :
                        ev.type === 'assignment' ? '#a78bfa' : '#fbbf24',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="text-xs text-ace-muted">
                      {formatTime(ev.start)} – {formatTime(ev.end)}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </div>
                  </div>
                  <span className="ace-pill text-xs uppercase">{ev.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ace-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Subjects</h2>
            <button className="text-xs text-ace-muted hover:text-white" onClick={() => openApp('subjects')}>
              Manage →
            </button>
          </div>
          <div className="text-xs text-ace-muted mb-1">
            Overall progress: {Math.round(averageProgress * 100)}%
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-violet-400"
              style={{ width: `${Math.round(averageProgress * 100)}%` }}
            />
          </div>
          <ul className="space-y-2">
            {subjects.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-ace-muted tabular-nums">{Math.round(s.progress * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ace-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Up next</h2>
          {nextUp && (
            <span className="text-xs text-ace-muted">
              Added {relativeFromNow(nextUp.createdAt)}
            </span>
          )}
        </div>
        {nextUp ? (
          <div className="flex items-center gap-3">
            <span className={classNames('ace-pill text-xs uppercase', priorityClass(nextUp.priority))}>
              {nextUp.priority}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{nextUp.title}</div>
              {nextUp.dueDate && (
                <div className="text-xs text-ace-muted">Due {formatTime(nextUp.dueDate)}</div>
              )}
            </div>
            <button
              className="ace-btn-primary"
              onClick={async () => {
                await api.updateTask(nextUp.id, { completed: true });
                setTasks(await api.listTasks());
                pushNotification({ title: 'Task done', message: nextUp.title, category: 'task' });
              }}
            >
              Mark done
            </button>
          </div>
        ) : (
          <p className="text-sm text-ace-muted">No outstanding tasks.</p>
        )}
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'planner', label: 'Plan week' },
          { id: 'focus', label: '25-min focus' },
          { id: 'ai', label: 'Ask AI' },
          { id: 'statistics', label: 'See progress' },
        ].map((q) => (
          <button
            key={q.id}
            className="ace-tile p-4 text-sm font-medium"
            onClick={() => openApp(q.id as never)}
          >
            {q.label}
          </button>
        ))}
      </section>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; hint?: string; accent: string }> = ({
  label, value, hint, accent,
}) => (
  <div
    className="rounded-2xl border border-white/10 p-4"
    style={{ background: `linear-gradient(135deg, ${accent}33, transparent 60%)` }}
  >
    <div className="text-xs uppercase tracking-wide text-ace-muted">{label}</div>
    <div className="text-2xl font-semibold mt-1">{value}</div>
    {hint && <div className="text-xs text-ace-muted mt-1">{hint}</div>}
  </div>
);

function priorityClass(p: Task['priority']) {
  return (
    p === 'urgent' ? 'bg-red-500/30 border-red-400/30 text-red-100' :
    p === 'high' ? 'bg-orange-500/20 border-orange-400/30 text-orange-100' :
    p === 'medium' ? 'bg-amber-500/20 border-amber-400/30 text-amber-100' :
    'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default HomeApp;

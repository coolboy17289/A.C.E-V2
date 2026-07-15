import React, { useEffect, useMemo, useState } from 'react';
import {
  api,
  classNames,
  formatTime,
  useAceStore,
  type CalendarEvent,
  type Subject,
} from '@ace/shared';

/**
 * A.C.E Planner - weekly calendar. Touch-friendly 7-day grid sized for
 * a 7" screen; the "today" column is highlighted and past events fade.
 */
const PlannerApp: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState<null | { date: Date; slot?: number }>(null);
  const toast = useAceStore((s) => s.toast);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [e, s] = await Promise.all([api.listEvents(), api.listSubjects()]);
    setEvents(e);
    setSubjects(s);
  }

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400e3));
  }, [weekStart]);

  async function save(ev: Omit<CalendarEvent, 'id'>) {
    const created = await api.createEvent(ev);
    setEvents((p) => [...p, created]);
    toast({ title: 'Event added', body: created.title, variant: 'success' });
    setEditing(null);
  }

  async function remove(id: string) {
    await api.deleteEvent(id);
    setEvents((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Planner</h1>
          <p className="text-xs text-ace-muted">{formatDate(days[0])} – {formatDate(days[6])}</p>
        </div>
        <div className="flex gap-2">
          <button className="ace-btn" onClick={() => setWeekStart(startOfWeek(new Date(weekStart.getTime() - 7 * 86400e3)))}>←</button>
          <button className="ace-btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</button>
          <button className="ace-btn" onClick={() => setWeekStart(startOfWeek(new Date(weekStart.getTime() + 7 * 86400e3)))}>→</button>
          <button className="ace-btn-primary" onClick={() => setEditing({ date: new Date() })}>＋ Event</button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-2 min-h-[60vh]">
        {days.map((d) => {
          const isToday = sameDay(d, new Date());
          const dayEvents = events
            .filter((e) => sameDay(new Date(e.start), d))
            .sort((a, b) => +new Date(a.start) - +new Date(b.start));
          return (
            <div
              key={d.toISOString()}
              className={classNames(
                'rounded-2xl border border-white/10 p-2 flex flex-col',
                isToday ? 'bg-ace-accent/10 border-ace-accent/40' : 'bg-white/[0.03]',
              )}
              onClick={() => setEditing({ date: d })}
            >
              <div className="text-xs text-ace-muted uppercase tracking-wide mb-1">
                {d.toLocaleDateString([], { weekday: 'short' })}
              </div>
              <div className="text-lg font-semibold mb-2">{d.getDate()}</div>
              <ul className="space-y-1 flex-1">
                {dayEvents.map((ev) => {
                  const subj = subjects.find((s) => s.id === ev.subjectId);
                  return (
                    <li
                      key={ev.id}
                      className="rounded-lg p-1.5 text-xs cursor-pointer"
                      style={{
                        background: `linear-gradient(135deg, ${typeColor(ev.type)}55, transparent)`,
                        border: `1px solid ${typeColor(ev.type)}55`,
                      }}
                      onClick={(e) => { e.stopPropagation(); remove(ev.id); }}
                      title="Tap to remove"
                    >
                      <div className="font-semibold truncate">{ev.title}</div>
                      <div className="text-ace-muted">{formatTime(ev.start)}</div>
                      {subj && <div className="text-[10px]" style={{ color: subj.color }}>● {subj.name}</div>}
                    </li>
                  );
                })}
                {dayEvents.length === 0 && (
                  <li className="text-[11px] text-ace-muted/70 italic">+ tap to add</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {editing && (
        <EventModal
          date={editing.date}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
};

const EventModal: React.FC<{
  date: Date;
  subjects: Subject[];
  onClose: () => void;
  onSave: (e: Omit<CalendarEvent, 'id'>) => Promise<void>;
}> = ({ date, subjects, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarEvent['type']>('class');
  const [subjectId, setSubjectId] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState(() => dateWith(date, 9, 0).toISOString().slice(0, 16));
  const [end, setEnd] = useState(() => dateWith(date, 10, 0).toISOString().slice(0, 16));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onSave({
      title, type, subjectId: subjectId || undefined, location: location || undefined,
      start: new Date(start).toISOString(), end: new Date(end).toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="ace-card w-full max-w-md space-y-3">
        <h2 className="font-semibold">New event</h2>
        <input className="ace-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select className="ace-input" value={type} onChange={(e) => setType(e.target.value as CalendarEvent['type'])}>
            {(['class','exam','assignment','session','event'] as CalendarEvent['type'][]).map((t) =>
              <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="ace-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">No subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ace-muted">Start
            <input type="datetime-local" className="ace-input" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="text-xs text-ace-muted">End
            <input type="datetime-local" className="ace-input" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <input className="ace-input" placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className="ace-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="ace-btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const offset = (x.getDay() + 6) % 7; // Monday-start
  x.setDate(x.getDate() - offset);
  return x;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateWith(d: Date, h: number, m: number) {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}

function typeColor(t: CalendarEvent['type']) {
  return (
    t === 'exam' ? '#f87171' :
    t === 'class' ? '#60a5fa' :
    t === 'assignment' ? '#a78bfa' :
    t === 'session' ? '#34d399' :
    '#fbbf24'
  );
}

export default PlannerApp;

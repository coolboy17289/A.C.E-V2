import React, { useEffect, useMemo, useState } from 'react';
import {
  api,
  classNames,
  formatDate,
  useAceStore,
  type Task,
  type TaskPriority,
  type Subject,
} from '@ace/shared';

/**
 * A.C.E Tasks - capturing, prioritising and completing work. Optimistic
 * updates keep the touch latency snappy on the Pi while the backend write
 * happens in the background.
 */
const TasksApp: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [draft, setDraft] = useState({ title: '', description: '', priority: 'medium' as TaskPriority, subjectId: '' });
  const [busy, setBusy] = useState(false);
  const toast = useAceStore((s) => s.toast);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [t, s] = await Promise.all([api.listTasks(), api.listSubjects()]);
    setTasks(t);
    setSubjects(s);
  }

  const visible = useMemo(() => {
    return tasks.filter((t) => (
      (filter === 'all' ? true : filter === 'open' ? !t.completed : t.completed)
    ) && (priorityFilter === 'all' || t.priority === priorityFilter)
    );
  }, [tasks, filter, priorityFilter]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      const created = await api.createTask({
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        priority: draft.priority,
        completed: false,
        subjectId: draft.subjectId || undefined,
      });
      setTasks((p) => [created, ...p]);
      setDraft({ title: '', description: '', priority: 'medium', subjectId: '' });
      toast({ title: 'Task added', body: created.title, variant: 'success' });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(t: Task) {
    const next = await api.updateTask(t.id, { completed: !t.completed });
    setTasks((p) => p.map((x) => (x.id === next.id ? next : x)));
  }

  async function remove(t: Task) {
    await api.deleteTask(t.id);
    setTasks((p) => p.filter((x) => x.id !== t.id));
    toast({ title: 'Removed', body: t.title, variant: 'warning' });
  }

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-xs text-ace-muted">{visible.length} shown · {tasks.filter((t) => !t.completed).length} open</p>
        </div>
        <div className="flex gap-2">
          {(['open', 'all', 'done'] as const).map((f) => (
            <button
              key={f}
              className={classNames(
                'ace-btn capitalize',
                filter === f && 'border-white/40 bg-white/10',
              )}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <form
        onSubmit={addTask}
        className="ace-card grid gap-3 grid-cols-1 sm:grid-cols-[1fr_180px_180px_120px]"
      >
        <input
          className="ace-input sm:col-span-1"
          placeholder="New task title…"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          aria-label="Task title"
        />
        <select
          className="ace-input"
          value={draft.priority}
          onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
          aria-label="Priority"
        >
          {(['low','medium','high','urgent'] as TaskPriority[]).map((p) => (
            <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        <select
          className="ace-input"
          value={draft.subjectId}
          onChange={(e) => setDraft({ ...draft, subjectId: e.target.value })}
          aria-label="Subject"
        >
          <option value="">No subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="ace-btn-primary" disabled={busy || !draft.title.trim()}>
          {busy ? 'Adding…' : 'Add task'}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <PriorityChip current={priorityFilter} value="all" setValue={setPriorityFilter} />
        {(['low','medium','high','urgent'] as TaskPriority[]).map((p) => (
          <PriorityChip key={p} current={priorityFilter} value={p} setValue={setPriorityFilter} />
        ))}
      </div>

      <ul className="space-y-2">
        {visible.length === 0 && (
          <li className="ace-card text-ace-muted text-sm">Nothing here. Add a task above.</li>
        )}
        {visible.map((t) => {
          const subj = subjects.find((s) => s.id === t.subjectId);
          return (
            <li
              key={t.id}
              className={classNames(
                'ace-card flex items-center gap-3 group',
                t.completed && 'opacity-60',
              )}
            >
              <button
                aria-label={t.completed ? 'Mark open' : 'Mark done'}
                className={classNames(
                  'w-7 h-7 rounded-full border flex items-center justify-center flex-none',
                  t.completed ? 'bg-emerald-500/80 border-emerald-300/40 text-white' : 'border-white/30 hover:bg-white/10',
                )}
                onClick={() => toggle(t)}
              >
                {t.completed ? '✓' : ''}
              </button>
              <div className="flex-1 min-w-0">
                <div className={classNames('font-medium', t.completed && 'line-through')}>{t.title}</div>
                {t.description && (
                  <div className="text-xs text-ace-muted truncate">{t.description}</div>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-ace-muted mt-1">
                  {subj && (
                    <span className="ace-pill" style={{ color: subj.color }}>● {subj.name}</span>
                  )}
                  {t.dueDate && <span>Due {formatDate(t.dueDate)}</span>}
                  <span className={classNames('ace-pill uppercase', priorityClass(t.priority))}>{t.priority}</span>
                </div>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 ace-btn"
                onClick={() => remove(t)}
                aria-label={`Delete ${t.title}`}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const PriorityChip: React.FC<{
  current: TaskPriority | 'all';
  value: TaskPriority | 'all';
  setValue: (v: TaskPriority | 'all') => void;
}> = ({ current, value, setValue }) => (
  <button
    className={classNames(
      'ace-pill capitalize cursor-pointer',
      current === value && 'border-white/40 bg-white/10',
    )}
    onClick={() => setValue(value)}
  >
    {value}
  </button>
);

function priorityClass(p: TaskPriority) {
  return (
    p === 'urgent' ? 'border-red-400/40 bg-red-500/20' :
    p === 'high' ? 'border-orange-400/40 bg-orange-500/15' :
    p === 'medium' ? 'border-amber-400/40 bg-amber-500/15' :
    'border-emerald-400/40 bg-emerald-500/15'
  );
}

export default TasksApp;

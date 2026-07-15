import React, { useEffect, useMemo, useState } from 'react';
import {
  api,
  classNames,
  formatDate,
  useAceStore,
  type NoteRecord,
  type Subject,
} from '@ace/shared';

/**
 * A.C.E Subjects - folder list + per-subject notes. Tapping a subject
 * loads its notes; tapping a note opens an inline editor.
 */
const SubjectsApp: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [newSubjectOpen, setNewSubjectOpen] = useState(false);
  const [draftNote, setDraftNote] = useState<{ subjectId: string; title: string; body: string; tags: string }>(
    { subjectId: '', title: '', body: '', tags: '' },
  );
  const toast = useAceStore((s) => s.toast);

  useEffect(() => { void refresh(); }, []);
  async function refresh() {
    const [s, n] = await Promise.all([api.listSubjects(), api.listNotes()]);
    setSubjects(s);
    setNotes(n);
    if (!active && s.length) setActive(s[0].id);
  }

  const notesForActive = useMemo(
    () => notes.filter((n) => n.subjectId === active).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes, active],
  );

  async function createSubject(name: string, color: string) {
    if (!name.trim()) return;
    const created = await api.createSubject({
      name: name.trim(), color, targetHoursPerWeek: 3, progress: 0,
    });
    setSubjects((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
    setActive(created.id);
  }

  async function saveProgress(subjectId: string, percent: number) {
    const updated = await api.updateSubject(subjectId, { progress: percent / 100 });
    setSubjects((p) => p.map((x) => (x.id === subjectId ? updated : x)));
  }

  async function saveNote() {
    if (!draftNote.subjectId || !draftNote.title.trim()) return;
    const created = await api.createNote({
      subjectId: draftNote.subjectId,
      title: draftNote.title.trim(),
      body: draftNote.body,
      tags: draftNote.tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setNotes((p) => [created, ...p]);
    setDraftNote({ subjectId: draftNote.subjectId, title: '', body: '', tags: '' });
    toast({ title: 'Note saved', body: created.title, variant: 'success' });
  }

  async function editNoteBody(n: NoteRecord, body: string) {
    const updated = await api.updateNote(n.id, { body });
    setNotes((p) => p.map((x) => (x.id === updated.id ? updated : x)));
  }

  return (
    <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 min-h-0">
      <aside className="ace-card flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Subjects</h2>
          <button className="ace-btn" onClick={() => setNewSubjectOpen(true)}>＋</button>
        </div>
        <ul className="flex-1 overflow-y-auto space-y-1 -mr-1 pr-1">
          {subjects.map((s) => (
            <li key={s.id}>
              <button
                className={classNames(
                  'w-full text-left flex items-center gap-2 p-2 rounded-xl transition',
                  active === s.id ? 'bg-white/10 border border-white/10' : 'hover:bg-white/5',
                )}
                onClick={() => setActive(s.id)}
              >
                <span className="w-2 h-2 rounded-full flex-none" style={{ background: s.color }} />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-xs text-ace-muted">{Math.round(s.progress * 100)}%</span>
              </button>
            </li>
          ))}
          {subjects.length === 0 && (
            <li className="text-xs text-ace-muted p-3">No subjects yet.</li>
          )}
        </ul>
      </aside>

      <section className="space-y-4 min-w-0">
        {active ? (
          <SubjectDetail
            subject={subjects.find((s) => s.id === active)!}
            notes={notesForActive}
            onSaveProgress={saveProgress}
            onEditNote={editNoteBody}
          />
        ) : (
          <div className="ace-card text-ace-muted text-sm">Select a subject to begin.</div>
        )}

        <div className="ace-card">
          <h3 className="font-semibold mb-2">Quick add note</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2 mb-2">
            <select
              className="ace-input"
              value={draftNote.subjectId || active || ''}
              onChange={(e) => setDraftNote({ ...draftNote, subjectId: e.target.value })}
            >
              <option value="">Subject…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input
              className="ace-input"
              placeholder="Title"
              value={draftNote.title}
              onChange={(e) => setDraftNote({ ...draftNote, title: e.target.value })}
            />
          </div>
          <textarea
            className="ace-input min-h-[80px] mb-2"
            placeholder="Note body…"
            value={draftNote.body}
            onChange={(e) => setDraftNote({ ...draftNote, body: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              className="ace-input"
              placeholder="Tags (comma separated)"
              value={draftNote.tags}
              onChange={(e) => setDraftNote({ ...draftNote, tags: e.target.value })}
            />
            <button className="ace-btn-primary" onClick={saveNote}>Save</button>
          </div>
        </div>
      </section>

      {newSubjectOpen && <NewSubjectModal onClose={() => setNewSubjectOpen(false)} onCreate={createSubject} />}
    </div>
  );
};

const SubjectDetail: React.FC<{
  subject: Subject;
  notes: NoteRecord[];
  onSaveProgress: (id: string, pct: number) => void;
  onEditNote: (n: NoteRecord, body: string) => void;
}> = ({ subject, notes, onSaveProgress, onEditNote }) => {
  const [tab, setTab] = useState<'notes' | 'progress'>('notes');
  return (
    <div className="ace-card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="text-xl font-semibold">{subject.name}</h2>
          {subject.description && <p className="text-sm text-ace-muted">{subject.description}</p>}
        </div>
        <div className="text-xs text-ace-muted text-right">
          <div>Target {subject.targetHoursPerWeek}h / wk</div>
          <div>Progress {Math.round(subject.progress * 100)}%</div>
        </div>
      </div>
      <div className="flex gap-2 text-sm mb-2">
        <button className={classNames('ace-pill cursor-pointer', tab === 'notes' && 'bg-white/10 border-white/30')} onClick={() => setTab('notes')}>Notes ({notes.length})</button>
        <button className={classNames('ace-pill cursor-pointer', tab === 'progress' && 'bg-white/10 border-white/30')} onClick={() => setTab('progress')}>Progress</button>
      </div>
      {tab === 'notes' ? (
        notes.length === 0 ? (
          <p className="text-sm text-ace-muted">No notes yet. Add one below.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => <NoteCard key={n.id} note={n} onEdit={onEditNote} />)}
          </ul>
        )
      ) : (
        <ProgressEditor subject={subject} onSave={onSaveProgress} />
      )}
    </div>
  );
};

const NoteCard: React.FC<{ note: NoteRecord; onEdit: (n: NoteRecord, body: string) => void }> = ({ note, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  return (
    <li className="rounded-xl border border-white/10 p-3 bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{note.title}</div>
          <div className="text-xs text-ace-muted">Updated {formatDate(note.updatedAt)} · revisions {note.revisionCount}</div>
        </div>
        <button className="ace-pill text-xs cursor-pointer" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      {editing ? (
        <textarea
          className="ace-input min-h-[120px] mt-2"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => { if (body !== note.body) onEdit(note, body); }}
        />
      ) : (
        <p className="text-sm whitespace-pre-wrap mt-2">{note.body}</p>
      )}
      {note.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {note.tags.map((t) => <span key={t} className="ace-pill text-xs">#{t}</span>)}
        </div>
      )}
    </li>
  );
};

const ProgressEditor: React.FC<{ subject: Subject; onSave: (id: string, pct: number) => void }> = ({ subject, onSave }) => {
  const [pct, setPct] = useState(Math.round(subject.progress * 100));
  return (
    <div>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-ace-muted my-1">
        <span>0%</span><span>{pct}%</span><span>100%</span>
      </div>
      <button className="ace-btn-primary" onClick={() => onSave(subject.id, pct)}>Save progress</button>
    </div>
  );
};

const SUBJECT_COLORS = ['#60a5fa','#a78bfa','#34d399','#fbbf24','#f87171','#22d3ee','#f472b6'];

const NewSubjectModal: React.FC<{
  onClose: () => void;
  onCreate: (name: string, color: string) => Promise<void>;
}> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="ace-card w-full max-w-sm space-y-3">
        <h2 className="font-semibold">New subject</h2>
        <input className="ace-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              className={classNames('w-7 h-7 rounded-full border-2', color === c ? 'border-white' : 'border-transparent')}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button className="ace-btn" onClick={onClose}>Cancel</button>
          <button className="ace-btn-primary" onClick={async () => { await onCreate(name, color); onClose(); }}>Create</button>
        </div>
      </div>
    </div>
  );
};

export default SubjectsApp;

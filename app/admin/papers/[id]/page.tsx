'use client';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, pb } from '@/lib/pb';
import Rich from '@/components/Rich';
import PaperImage from '@/components/PaperImage';
import StatusPill from '@/components/StatusPill';
import { SUBJECT_STYLE } from '@/components/format';

interface AdminQ {
  id: string; paper: string; number: number; subject: string; question: string; options: string[];
  display: 'text' | 'image'; imageUrl: string | null; answer: number | null; solution: string;
  solutionImageUrl: string | null; note: string; status: string; page: number | null;
}
interface Paper { id: string; title: string; exam: string; year: number; status: string; pdfUrl: string | null }
type Filter = 'all' | 'attention' | 'draft' | 'published';

const needsAttention = (q: AdminQ) => !q.answer || (q.display === 'text' && q.options.some((o) => !o.trim())) || (q.display === 'image' && !q.imageUrl) || !!q.note;

export default function ReviewPaper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [qs, setQs] = useState<AdminQ[] | null>(null);
  const [subject, setSubject] = useState('All');
  const [filter, setFilter] = useState<Filter>('all');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api<Paper>(`/api/admin/papers/${id}`).then(setPaper).catch((e) => setMsg({ ok: false, text: e.message }));
    api<{ questions: AdminQ[] }>(`/api/admin/papers/${id}/questions`).then((r) => setQs(r.questions)).catch((e) => setMsg({ ok: false, text: e.message }));
  };
  useEffect(load, [id]);

  const subjects = useMemo(() => ['All', ...new Set((qs || []).map((q) => q.subject))], [qs]);
  const shown = useMemo(() => (qs || []).filter((q) =>
    (subject === 'All' || q.subject === subject) &&
    (filter === 'all' || (filter === 'attention' ? needsAttention(q) : q.status === filter))), [qs, subject, filter]);

  if (!qs || !paper) return <p className="text-slate-500">{msg?.text || 'Loading…'}</p>;

  const drafts = qs.filter((q) => q.status !== 'published').length;
  const attention = qs.filter(needsAttention).length;
  const noAnswer = qs.filter((q) => !q.answer).length;

  const publish = async (ids?: string[], status: 'published' | 'draft' = 'published') => {
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ changed: number; published: number }>(`/api/admin/papers/${id}/publish`, { method: 'POST', body: JSON.stringify({ ids, status }) });
      setMsg({ ok: true, text: status === 'published' ? `Published ${r.changed} question(s). ${r.published} live in this paper.` : `Moved ${r.changed} question(s) back to draft.` });
      load();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };

  const addQuestion = async () => {
    const fd = new FormData();
    fd.set('paper', id);
    fd.set('number', String(Math.max(0, ...qs.map((q) => q.number)) + 1));
    fd.set('subject', subject !== 'All' ? subject : 'Physics');
    fd.set('question', ''); fd.set('options', '["","","",""]'); fd.set('display', 'text');
    const res = await fetch('/api/admin/questions', { method: 'POST', headers: { Authorization: pb().authStore.token }, body: fd });
    const q = await res.json();
    if (res.ok) { setQs([...qs, q]); setFilter('all'); setTimeout(() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth' }), 100); }
  };

  return (
    <div>
      <Link href="/admin" className="text-sm font-medium text-slate-500 hover:text-slate-800">← Question bank</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{paper.title}</h1>
        <StatusPill s={paper.status} />
        {paper.pdfUrl && <a href={paper.pdfUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600">Open PDF ↗</a>}
      </div>
      <p className="mt-1 text-sm text-slate-600">{qs.length} questions · {qs.length - drafts} live · {drafts} draft{noAnswer ? ` · ${noAnswer} missing an answer` : ''}</p>

      <div className="sticky top-14 z-20 -mx-4 mt-4 border-y border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {subjects.map((s) => (
            <button key={s} onClick={() => setSubject(s)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${subject === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
              {s} {s !== 'All' && <span className="opacity-60">{qs.filter((q) => q.subject === s).length}</span>}
            </button>
          ))}
          <select className="input !w-auto !py-1.5" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All questions</option>
            <option value="attention">Needs attention ({attention})</option>
            <option value="draft">Drafts ({drafts})</option>
            <option value="published">Live ({qs.length - drafts})</option>
          </select>
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn-ghost !py-2" onClick={addQuestion}>+ Add question</button>
            <button className="btn-primary !py-2" disabled={busy || drafts === 0} onClick={() => publish()}>Publish all drafts</button>
          </div>
        </div>
        {msg && <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      </div>

      <div className="mt-4 space-y-4">
        {shown.length === 0 && <p className="card p-6 text-sm text-slate-500">No questions match.</p>}
        {shown.map((q) => (
          <Editor key={q.id} q={q}
            onSaved={(nq) => setQs((all) => all!.map((x) => (x.id === nq.id ? nq : x)))}
            onDeleted={() => setQs((all) => all!.filter((x) => x.id !== q.id))}
            onPublish={(status) => publish([q.id], status)} />
        ))}
      </div>

      <div className="mt-10 border-t border-slate-200 pt-6">
        <button className="text-sm font-medium text-red-600" onClick={async () => {
          if (!confirm(`Delete "${paper.title}" and all ${qs.length} questions? Students' past results that used them will lose those questions.`)) return;
          await api(`/api/admin/papers/${id}`, { method: 'DELETE' });
          router.replace('/admin');
        }}>Delete this paper</button>
      </div>
    </div>
  );
}

function Editor({ q, onSaved, onDeleted, onPublish }: { q: AdminQ; onSaved: (q: AdminQ) => void; onDeleted: () => void; onPublish: (s: 'published' | 'draft') => void }) {
  const [d, setD] = useState(q);
  const [files, setFiles] = useState<{ question_image?: File; solution_image?: File }>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setD(q); setFiles({}); }, [q]);
  const dirty = JSON.stringify(d) !== JSON.stringify(q) || !!files.question_image || !!files.solution_image;
  const set = <K extends keyof AdminQ>(k: K, v: AdminQ[K]) => setD({ ...d, [k]: v });
  const sty = SUBJECT_STYLE[d.subject];

  const save = async () => {
    setSaving(true); setErr('');
    const fd = new FormData();
    fd.set('number', String(d.number)); fd.set('subject', d.subject); fd.set('question', d.question);
    fd.set('options', JSON.stringify(d.options)); fd.set('answer', d.answer ? String(d.answer) : '');
    fd.set('solution', d.solution); fd.set('display', d.display); fd.set('note', d.note);
    if (files.question_image) fd.set('question_image', files.question_image);
    if (files.solution_image) fd.set('solution_image', files.solution_image);
    if (!d.imageUrl && q.imageUrl) fd.set('remove_question_image', '1');
    if (!d.solutionImageUrl && q.solutionImageUrl) fd.set('remove_solution_image', '1');
    const res = await fetch(`/api/admin/questions/${q.id}`, { method: 'PATCH', headers: { Authorization: pb().authStore.token }, body: fd });
    const data = await res.json();
    if (res.ok) onSaved(data); else setErr(data.error || 'Save failed');
    setSaving(false);
  };

  return (
    <div id={`q-${q.id}`} className={`card min-w-0 p-5 ${needsAttention(q) ? 'border-amber-300' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Q</span>
        <input type="number" className="input !w-20 !py-1" value={d.number} onChange={(e) => set('number', Number(e.target.value))} />
        <select className={`input !w-auto !py-1 font-semibold ${sty?.text}`} value={d.subject} onChange={(e) => set('subject', e.target.value)}>
          {['Physics', 'Chemistry', 'Biology', 'Mathematics'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg ring-1 ring-slate-200">
          {(['text', 'image'] as const).map((m) => (
            <button key={m} onClick={() => set('display', m)} className={`px-3 py-1 text-xs font-semibold capitalize ${d.display === m ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Show as {m}</button>
          ))}
        </div>
        {q.page && <span className="text-xs text-slate-400">PDF page {q.page}</span>}
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${q.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{q.status === 'published' ? 'Live' : 'Draft'}</span>
      </div>

      {d.note && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex-1">⚠ {d.note}</span>
          <button className="text-xs font-semibold underline" onClick={() => set('note', '')}>Mark resolved</button>
        </div>
      )}

      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div>
            <label className="label">Question text</label>
            <textarea className="input min-h-24 font-mono text-[13px]" value={d.question} onChange={(e) => set('question', e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Use &lt;sub&gt;2&lt;/sub&gt; and &lt;sup&gt;–1&lt;/sup&gt; for subscripts / superscripts.</p>
          </div>
          <div>
            <label className="label">Options — tick the correct one</label>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`flex items-center gap-2 rounded-xl border-2 p-1.5 pl-3 ${d.answer === i + 1 ? 'border-emerald-500 bg-emerald-50' : 'border-transparent'}`}>
                  <input type="radio" name={`ans-${q.id}`} className="h-4 w-4 accent-emerald-600" checked={d.answer === i + 1} onChange={() => set('answer', i + 1)} aria-label={`Option ${i + 1} is correct`} />
                  <span className="w-5 text-sm font-semibold text-slate-500">{i + 1}</span>
                  <input className="input !py-1.5 font-mono text-[13px]" value={d.options[i] || ''} placeholder={d.display === 'image' ? '(shown in image)' : ''}
                    onChange={(e) => { const o = [...d.options]; o[i] = e.target.value; set('options', o); }} />
                </div>
              ))}
            </div>
            {!d.answer && <p className="mt-1 text-xs font-medium text-red-600">No correct answer set — it can&apos;t be published until you pick one.</p>}
          </div>
          <div>
            <label className="label">Solution (text)</label>
            <textarea className="input min-h-16 font-mono text-[13px]" value={d.solution} onChange={(e) => set('solution', e.target.value)} />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <div className="label">What students see</div>
            <div className="rounded-xl border border-slate-200 p-4">
              {d.display === 'image' ? (
                d.imageUrl || files.question_image ? (
                  <PaperImage src={files.question_image ? URL.createObjectURL(files.question_image) : d.imageUrl!} alt="" />
                ) : <p className="text-sm text-red-600">Image mode, but no image — upload one or switch to text.</p>
              ) : (
                <>
                  <p className="leading-relaxed"><Rich html={d.question || '<i>(empty question)</i>'} /></p>
                  <ol className="mt-3 space-y-1 text-sm">{d.options.map((o, i) => <li key={i} className={d.answer === i + 1 ? 'font-semibold text-emerald-700' : ''}>({i + 1}) <Rich html={o} /></li>)}</ol>
                </>
              )}
            </div>
          </div>
          <ImageField label="Question image" url={d.imageUrl} file={files.question_image}
            onFile={(f) => setFiles({ ...files, question_image: f })} onRemove={() => { set('imageUrl', null); setFiles({ ...files, question_image: undefined }); }} />
          <ImageField label="Solution image" url={d.solutionImageUrl} file={files.solution_image}
            onFile={(f) => setFiles({ ...files, solution_image: f })} onRemove={() => { set('solutionImageUrl', null); setFiles({ ...files, solution_image: undefined }); }} />
        </div>
      </div>

      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button className="btn-primary !py-2" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
        {dirty && <button className="btn-ghost !py-2" onClick={() => { setD(q); setFiles({}); }}>Discard</button>}
        {q.status === 'published'
          ? <button className="btn-ghost !py-2" disabled={dirty} onClick={() => onPublish('draft')}>Unpublish</button>
          : <button className="btn-ghost !py-2 !border-emerald-300 !text-emerald-700" disabled={dirty || !q.answer} onClick={() => onPublish('published')}>Publish</button>}
        <button className="ml-auto text-sm font-medium text-red-600" onClick={async () => {
          if (!confirm(`Delete question ${q.number}?`)) return;
          const res = await fetch(`/api/admin/questions/${q.id}`, { method: 'DELETE', headers: { Authorization: pb().authStore.token } });
          if (res.ok) onDeleted();
        }}>Delete</button>
      </div>
    </div>
  );
}

function ImageField({ label, url, file, onFile, onRemove }: { label: string; url: string | null; file?: File; onFile: (f: File) => void; onRemove: () => void }) {
  const has = !!url || !!file;
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="label !mb-0">{label}</span>
        <label className="cursor-pointer text-xs font-semibold text-brand-600">
          {has ? 'Replace' : 'Upload'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {has && <button className="text-xs font-semibold text-red-600" onClick={onRemove}>Remove</button>}
        {file && <span className="text-xs text-amber-700">new image — save to apply</span>}
      </div>
      {has && <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 p-2"><PaperImage src={file ? URL.createObjectURL(file) : url!} alt={label} /></div>}
    </div>
  );
}

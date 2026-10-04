'use client';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/pb';
import type { PublicQuestion } from '@/lib/types';
import { useAuth } from '@/components/useAuth';
import Rich from '@/components/Rich';
import PaperImage from '@/components/PaperImage';
import { fmtClock, SUBJECT_STYLE } from '@/components/format';

interface AttemptData {
  id: string; mode: string; subject: string; submitted: boolean;
  answers: Record<string, number>; marked: string[];
  deadline: number | null; serverNow: number; questions: PublicQuestion[];
}

export default function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AttemptData | null>(null);
  const [error, setError] = useState('');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [left, setLeft] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const offset = useRef(0);
  const latest = useRef({ answers, marked });
  latest.current = { answers, marked };
  const dirty = useRef(false);

  // load
  useEffect(() => {
    if (!user) return;
    api<AttemptData>(`/api/attempts/${id}`)
      .then((d) => {
        if (d.submitted) return router.replace(`/results/${id}`);
        offset.current = d.serverNow - Date.now();
        setData(d);
        setAnswers(d.answers);
        setMarked(new Set(d.marked));
        if (d.questions[0]) setVisited(new Set([d.questions[0].id]));
      })
      .catch((e) => setError(e.message));
  }, [id, user, router]);

  const qs = data?.questions || [];
  const q = qs[idx];

  // autosave
  const save = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState('saving');
    try {
      await api(`/api/attempts/${id}`, { method: 'PATCH', body: JSON.stringify({ answers: latest.current.answers, marked: [...latest.current.marked] }) });
      setSaveState('saved');
    } catch { dirty.current = true; setSaveState('error'); }
  }, [id]);
  useEffect(() => { const t = setInterval(save, 4000); return () => clearInterval(t); }, [save]);
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [save]);

  const submittedRef = useRef(false);
  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await api(`/api/attempts/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers: latest.current.answers, marked: [...latest.current.marked] }) });
      router.replace(`/results/${id}`);
    } catch (e: any) { setError(e.message); setSubmitting(false); submittedRef.current = false; }
  }, [id, router]);

  // timer
  useEffect(() => {
    if (!data?.deadline) return;
    const tick = () => {
      const s = (data.deadline! - (Date.now() + offset.current)) / 1000;
      setLeft(s);
      if (s <= 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data, submit]);

  const go = useCallback((i: number) => {
    if (i < 0 || i >= qs.length) return;
    setIdx(i);
    setVisited((v) => new Set(v).add(qs[i].id));
    setPaletteOpen(false);
    window.scrollTo({ top: 0 });
  }, [qs]);

  const choose = useCallback((opt: number) => {
    if (!q) return;
    dirty.current = true;
    setAnswers((a) => (a[q.id] === opt ? (({ [q.id]: _, ...rest }) => rest)(a) : { ...a, [q.id]: opt }));
  }, [q]);

  const toggleMark = () => {
    if (!q) return;
    dirty.current = true;
    setMarked((m) => { const n = new Set(m); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; });
  };

  // keyboard: 1-4 to answer, arrows to move
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (confirm || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (['1', '2', '3', '4'].includes(e.key)) choose(Number(e.key));
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [choose, go, idx, confirm]);

  const stats = useMemo(() => {
    const answered = qs.filter((x) => answers[x.id]).length;
    return { answered, notAnswered: qs.length - answered, marked: marked.size, notVisited: qs.filter((x) => !visited.has(x.id)).length };
  }, [qs, answers, marked, visited]);

  const sections = useMemo(() => {
    const out: { subject: string; start: number; end: number }[] = [];
    qs.forEach((x, i) => {
      const last = out[out.length - 1];
      if (last && last.subject === x.subject) last.end = i; else out.push({ subject: x.subject, start: i, end: i });
    });
    return out;
  }, [qs]);

  if (error && !data) return <div className="mx-auto max-w-md py-20 text-center"><p className="text-red-600">{error}</p><button className="btn-ghost mt-4" onClick={() => router.push('/dashboard')}>Back to dashboard</button></div>;
  if (!data || !q) return <div className="py-20 text-center text-slate-500">Loading test…</div>;

  const chosen = answers[q.id];
  const sty = SUBJECT_STYLE[q.subject];
  const lowTime = left !== null && left < 300;

  const Palette = (
    <div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Legend cls="bg-emerald-500 text-white" label={`Answered (${stats.answered})`} />
        <Legend cls="bg-violet-500 text-white" label={`Marked (${stats.marked})`} />
        <Legend cls="bg-white border border-red-300 text-red-600" label={`Not answered (${stats.notAnswered - stats.notVisited})`} />
        <Legend cls="bg-slate-100 text-slate-500" label={`Not visited (${stats.notVisited})`} />
      </div>
      {sections.map((s) => (
        <div key={s.subject + s.start} className="mt-4">
          {sections.length > 1 && <div className={`mb-2 text-xs font-semibold ${SUBJECT_STYLE[s.subject]?.text}`}>{s.subject}</div>}
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-5 lg:grid-cols-6">
            {qs.slice(s.start, s.end + 1).map((x, j) => {
              const i = s.start + j;
              const a = answers[x.id], m = marked.has(x.id), v = visited.has(x.id);
              const cls = m ? 'bg-violet-500 text-white' + (a ? ' ring-2 ring-emerald-400 ring-offset-1' : '')
                : a ? 'bg-emerald-500 text-white' : v ? 'bg-white border border-red-300 text-red-600' : 'bg-slate-100 text-slate-500';
              return (
                <button key={x.id} onClick={() => go(i)}
                  className={`h-9 rounded-lg text-xs font-semibold ${cls} ${i === idx ? 'outline-2 outline-offset-1 outline-brand-600' : ''}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="-mt-6">
      {/* top bar */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-slate-200 bg-white px-4 py-2.5 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{data.subject}</div>
            <div className="text-xs text-slate-500">
              {stats.answered}/{qs.length} answered · {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? <span className="text-red-600">Not saved — retrying</span> : 'Saved'}
            </div>
          </div>
          {left !== null && (
            <div className={`ml-auto rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${lowTime ? 'animate-pulse bg-red-50 text-red-600' : 'bg-slate-100'}`}>
              {fmtClock(left)}
            </div>
          )}
          <button className={`btn-primary !py-2 ${left === null ? 'ml-auto' : ''}`} onClick={() => { save(); setConfirm(true); }}>Submit</button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="card p-3 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 px-1 text-sm sm:px-0">
              <span className="font-semibold">Question {idx + 1}</span>
              <span className="text-slate-400">of {qs.length}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sty?.bg} ${sty?.text}`}>{q.subject}</span>
              <span className="ml-auto text-xs text-slate-400">+4 / −1</span>
            </div>

            {q.display === 'image' && q.imageUrl ? (
              <div className="mt-4">
                <PaperImage src={q.imageUrl} alt={`Question ${idx + 1}`} onZoom={() => setZoom(q.imageUrl)} />
                <p className="mt-2 text-center text-xs text-slate-400">Tap the question to enlarge · turn your phone sideways for bigger text</p>
              </div>
            ) : (
              <p className="mt-4 text-[17px] leading-relaxed"><Rich html={q.question} /></p>
            )}

            <div className={`mt-5 grid gap-2.5 ${q.display === 'image' ? 'grid-cols-2 sm:grid-cols-4' : ''}`}>
              {[1, 2, 3, 4].map((n) => {
                const sel = chosen === n;
                return (
                  <button key={n} onClick={() => choose(n)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition ${sel ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${sel ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{n}</span>
                    {q.display === 'image' ? <span className="text-sm font-medium">Option {n}</span> : <Rich html={q.options[n - 1] || ''} className="text-[15px]" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => go(idx - 1)} disabled={idx === 0}>← Previous</button>
            <button className="btn-ghost" onClick={() => { dirty.current = true; setAnswers(({ [q.id]: _, ...rest }) => rest); }} disabled={!chosen}>Clear</button>
            <button className={`btn-ghost ${marked.has(q.id) ? '!border-violet-300 !bg-violet-50 !text-violet-700' : ''}`} onClick={() => { toggleMark(); if (!marked.has(q.id)) go(idx + 1); }}>
              {marked.has(q.id) ? '★ Marked' : '☆ Mark for review'}
            </button>
            <button className="btn-primary ml-auto" onClick={() => (idx === qs.length - 1 ? (save(), setConfirm(true)) : go(idx + 1))}>
              {idx === qs.length - 1 ? 'Finish' : 'Save & next →'}
            </button>
          </div>
          <p className="mt-3 hidden text-xs text-slate-400 sm:block">Tip: press 1–4 to choose an option, ← → to move.</p>
        </div>

        <aside className="hidden lg:block">
          <div className="card sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4">{Palette}</div>
        </aside>
      </div>

      {/* mobile palette */}
      <button className="btn-primary fixed bottom-4 right-4 z-30 rounded-full shadow-lg lg:hidden" onClick={() => setPaletteOpen(true)}>
        ☰ Questions
      </button>
      {paletteOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setPaletteOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><span className="font-semibold">All questions</span><button className="text-sm text-slate-500" onClick={() => setPaletteOpen(false)}>Close</button></div>
            {Palette}
          </div>
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 overflow-auto bg-slate-900/80 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="mx-auto w-full max-w-4xl rounded-lg bg-white" />
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Submit test?</h3>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat n={stats.answered} l="Answered" c="text-emerald-600" />
              <Stat n={stats.notAnswered} l="Unanswered" c="text-red-600" />
              <Stat n={stats.marked} l="Marked" c="text-violet-600" />
            </div>
            {stats.notAnswered > 0 && <p className="mt-3 text-sm text-slate-600">Unanswered questions get 0 marks.</p>}
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirm(false)} disabled={submitting}>Keep going</button>
              <button className="btn-primary flex-1" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
      {submitting && !confirm && <div className="fixed inset-0 z-50 grid place-items-center bg-white/80 text-lg font-semibold">Time&apos;s up — submitting…</div>}
    </div>
  );
}

const Legend = ({ cls, label }: { cls: string; label: string }) => (
  <div className="flex items-center gap-2"><span className={`h-4 w-4 shrink-0 rounded ${cls}`} />{label}</div>
);
const Stat = ({ n, l, c }: { n: number; l: string; c: string }) => (
  <div className="rounded-xl bg-slate-50 p-2"><div className={`text-xl font-bold ${c}`}>{n}</div><div className="text-xs text-slate-500">{l}</div></div>
);

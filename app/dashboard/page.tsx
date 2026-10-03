'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RecordModel } from 'pocketbase';
import { api, pb } from '@/lib/pb';
import { SUBJECTS, type Mode } from '@/lib/types';
import { useAuth } from '@/components/useAuth';
import { SUBJECT_STYLE } from '@/components/format';
import AttemptList from '@/components/AttemptList';

type Setup = { mode: Mode; subject?: string; max: number };

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState<RecordModel[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const client = pb();
    Promise.all(
      SUBJECTS.map((s) => client.collection('questions').getList(1, 1, { filter: `subject="${s}"`, fields: 'id' }).then((r) => [s, r.totalItems] as const)),
    ).then((e) => setCounts(Object.fromEntries(e))).catch((e) => setError(e.message));
    client.collection('attempts').getList(1, 200, { sort: '-created', fields: 'id,mode,subject,score,correct,wrong,skipped,total,submitted_at,created' })
      .then((r) => setAttempts(r.items)).catch(() => {});
  }, [user]);

  if (!user) return null;
  const done = attempts.filter((a) => a.submitted_at);
  const inProgress = attempts.filter((a) => !a.submitted_at);
  const totalQs = Object.values(counts).reduce((a, b) => a + b, 0);

  const stat = (subject: string) => {
    const mine = done.filter((a) => a.subject === subject);
    const answered = mine.reduce((s, a) => s + a.correct + a.wrong, 0);
    const correct = mine.reduce((s, a) => s + a.correct, 0);
    return { tests: mine.length, accuracy: answered ? Math.round((correct / answered) * 100) : null };
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Hi {user.name?.split(' ')[0] || 'there'} 👋</h1>
      <p className="mt-1 text-slate-600">Pick a subject to practise. {totalQs ? `${totalQs} questions available.` : ''}</p>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {inProgress.length > 0 && (
        <div className="card mt-6 flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50 p-4">
          <span className="text-sm font-medium text-amber-900">You have an unfinished test: {inProgress[0].subject} · {inProgress[0].total} questions</span>
          <Link href={`/test/${inProgress[0].id}`} className="btn-primary ml-auto !py-2">Resume</Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {SUBJECTS.map((s) => {
          const st = stat(s), sty = SUBJECT_STYLE[s];
          return (
            <div key={s} className="card flex flex-col p-5">
              <div className="flex items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${sty.bg} ${sty.text}`}>{sty.icon}</span>
                <div>
                  <div className="text-lg font-semibold">{s}</div>
                  <div className="text-xs text-slate-500">{counts[s] ?? '…'} questions</div>
                </div>
              </div>
              <div className="mt-4 flex gap-6 text-sm">
                <div><div className="text-slate-500">Tests taken</div><div className="font-semibold">{st.tests}</div></div>
                <div><div className="text-slate-500">Accuracy</div><div className="font-semibold">{st.accuracy === null ? '—' : `${st.accuracy}%`}</div></div>
              </div>
              <button className="btn-primary mt-5" disabled={!counts[s]} onClick={() => setSetup({ mode: 'subject', subject: s, max: counts[s] })}>
                Practise {s}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card flex flex-col p-5">
          <div className="font-semibold">Mixed mock test</div>
          <p className="mt-1 text-sm text-slate-600">All three subjects in NEET ratio (Physics 25%, Chemistry 25%, Biology 50%).</p>
          <button className="btn-ghost mt-4 self-start" disabled={!totalQs} onClick={() => setSetup({ mode: 'mock', max: totalQs })}>Start mock test</button>
        </div>
        <div className="card flex flex-col p-5">
          <div className="font-semibold">Full previous-year paper</div>
          <p className="mt-1 text-sm text-slate-600">All {totalQs || 180} questions in original order — 3 hours, just like exam day.</p>
          <button className="btn-ghost mt-4 self-start" disabled={!totalQs} onClick={() => setSetup({ mode: 'paper', max: totalQs })}>Start full paper</button>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent tests</h2>
        {done.length > 0 && <Link href="/history" className="text-sm font-semibold text-brand-600">View all</Link>}
      </div>
      {done.length === 0 ? (
        <p className="card mt-3 p-6 text-sm text-slate-500">No tests yet — your results will show up here.</p>
      ) : (
        <AttemptList items={done.slice(0, 5)} />
      )}

      {setup && <SetupDialog setup={setup} onClose={() => setSetup(null)} onStart={async (opts) => {
        const r = await api<{ id: string }>('/api/attempts', { method: 'POST', body: JSON.stringify({ ...opts, mode: setup.mode, subject: setup.subject }) });
        router.push(`/test/${r.id}`);
      }} />}
    </div>
  );
}

function SetupDialog({ setup, onClose, onStart }: { setup: Setup; onClose: () => void; onStart: (o: { count: number; timed: boolean; freshOnly: boolean }) => Promise<void> }) {
  const presets = setup.mode === 'subject' ? [10, 20, 45, setup.max] : setup.mode === 'mock' ? [20, 60, 120, setup.max] : [];
  const uniq = [...new Set(presets.filter((n) => n > 0 && n <= setup.max))];
  const [count, setCount] = useState(uniq[1] ?? uniq[0] ?? setup.max);
  const [timed, setTimed] = useState(true);
  const [freshOnly, setFreshOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const n = setup.mode === 'paper' ? setup.max : count;
  const title = setup.mode === 'subject' ? setup.subject : setup.mode === 'mock' ? 'Mock test' : 'Full paper';

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-900/40 p-0 sm:place-items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{title}</h3>
        {setup.mode !== 'paper' && (
          <>
            <div className="label mt-4">Number of questions</div>
            <div className="flex flex-wrap gap-2">
              {uniq.map((c) => (
                <button key={c} onClick={() => setCount(c)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold ${count === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-700'}`}>
                  {c === setup.max ? `All ${c}` : c}
                </button>
              ))}
            </div>
          </>
        )}
        <label className="mt-5 flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
          Timed — {n} minutes (1 min per question, like NEET)
        </label>
        {setup.mode === 'subject' && (
          <label className="mt-3 flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={freshOnly} onChange={(e) => setFreshOnly(e.target.checked)} />
            Only questions I haven&apos;t attempted yet
          </label>
        )}
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Marking: +4 correct · −1 wrong · 0 unanswered</div>
        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={busy} onClick={async () => {
            setBusy(true); setErr('');
            try { await onStart({ count, timed, freshOnly }); } catch (e: any) { setErr(e.message); setBusy(false); }
          }}>{busy ? 'Starting…' : 'Start test'}</button>
        </div>
      </div>
    </div>
  );
}

'use client';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/pb';
import type { ReviewQuestion } from '@/lib/types';
import { useAuth } from '@/components/useAuth';
import Rich from '@/components/Rich';
import PaperImage from '@/components/PaperImage';
import { fmtDate, fmtDuration, SUBJECT_STYLE } from '@/components/format';

interface Review {
  id: string; mode: string; subject: string; score: number; correct: number; wrong: number; skipped: number;
  total: number; maxScore: number; time_taken: number; submitted_at: string;
  bySubject: Record<string, { total: number; correct: number; wrong: number; skipped: number; score: number }>;
  questions: ReviewQuestion[];
}
type Filter = 'all' | 'wrong' | 'skipped' | 'correct';

export default function Results({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [r, setR] = useState<Review | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Review>(`/api/attempts/${id}/review`).then(setR).catch((e) => setError(e.message));
  }, [id, user]);

  const list = useMemo(() => {
    if (!r) return [];
    return r.questions.map((q, i) => ({ q, i })).filter(({ q }) =>
      filter === 'all' ? true : filter === 'skipped' ? !q.chosen : filter === 'correct' ? q.chosen === q.answer : q.chosen && q.chosen !== q.answer);
  }, [r, filter]);

  if (error) return <div className="py-20 text-center"><p className="text-red-600">{error}</p><Link href="/dashboard" className="btn-ghost mt-4">Back to dashboard</Link></div>;
  if (!r) return <div className="py-20 text-center text-slate-500">Loading results…</div>;

  const attempted = r.correct + r.wrong;
  const accuracy = attempted ? Math.round((r.correct / attempted) * 100) : 0;
  const pct = Math.max(0, Math.round((r.score / r.maxScore) * 100));

  return (
    <div>
      <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">← Dashboard</Link>
      <div className="card mt-3 overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-indigo-700 p-6 text-white sm:p-8">
          <div className="text-sm opacity-80">{r.subject} · {fmtDate(r.submitted_at)}</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-extrabold tracking-tight">{r.score}</span>
            <span className="mb-1.5 text-lg opacity-80">/ {r.maxScore}</span>
            <span className="mb-1.5 ml-auto rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{pct}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-5 sm:divide-y-0">
          <Box l="Correct" v={r.correct} c="text-emerald-600" />
          <Box l="Wrong" v={r.wrong} c="text-red-600" />
          <Box l="Skipped" v={r.skipped} c="text-slate-500" />
          <Box l="Accuracy" v={`${accuracy}%`} />
          <Box l="Time taken" v={fmtDuration(r.time_taken)} />
        </div>
      </div>

      {Object.keys(r.bySubject).length > 1 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Object.entries(r.bySubject).map(([s, v]) => (
            <div key={s} className="card p-4">
              <div className={`text-sm font-semibold ${SUBJECT_STYLE[s]?.text}`}>{s}</div>
              <div className="mt-1 text-2xl font-bold">{v.score}<span className="text-sm font-normal text-slate-400">/{v.total * 4}</span></div>
              <div className="text-xs text-slate-500">✓ {v.correct} · ✗ {v.wrong} · – {v.skipped}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Review answers</h2>
        {(['all', 'wrong', 'skipped', 'correct'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${filter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {f}{f !== 'all' && ` (${f === 'wrong' ? r.wrong : f === 'skipped' ? r.skipped : r.correct})`}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {list.length === 0 && <p className="card p-6 text-sm text-slate-500">Nothing here.</p>}
        {list.map(({ q, i }) => {
          const status = !q.chosen ? 'skipped' : q.chosen === q.answer ? 'correct' : 'wrong';
          const badge = { correct: 'bg-emerald-50 text-emerald-700', wrong: 'bg-red-50 text-red-700', skipped: 'bg-slate-100 text-slate-600' }[status];
          return (
            <div key={q.id} className="card min-w-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Q{i + 1}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SUBJECT_STYLE[q.subject]?.bg} ${SUBJECT_STYLE[q.subject]?.text}`}>{q.subject}</span>
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${badge}`}>
                  {status}{status === 'correct' ? ' +4' : status === 'wrong' ? ' −1' : ''}
                </span>
              </div>
              {q.display === 'image' && q.imageUrl ? (
                <div className="mt-4"><PaperImage src={q.imageUrl} alt={`Question ${i + 1}`} onZoom={() => setZoom(q.imageUrl)} /></div>
              ) : (
                <p className="mt-3 leading-relaxed"><Rich html={q.question} /></p>
              )}
              <div className={`mt-4 grid gap-2 ${q.display === 'image' ? 'grid-cols-2 sm:grid-cols-4' : ''}`}>
                {[1, 2, 3, 4].map((n) => {
                  const isAns = n === q.answer, isMine = n === q.chosen;
                  const cls = isAns ? 'border-emerald-500 bg-emerald-50' : isMine ? 'border-red-400 bg-red-50' : 'border-slate-200';
                  return (
                    <div key={n} className={`flex items-center gap-3 rounded-xl border-2 p-3 text-sm ${cls}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${isAns ? 'bg-emerald-500 text-white' : isMine ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{n}</span>
                      {q.display === 'image' ? <span>Option {n}</span> : <Rich html={q.options[n - 1] || ''} />}
                      {isAns && <span className="ml-auto text-xs font-semibold text-emerald-700">Correct</span>}
                      {isMine && !isAns && <span className="ml-auto text-xs font-semibold text-red-600">Your answer</span>}
                    </div>
                  );
                })}
              </div>
              {(q.solutionImageUrl || q.solution) && (
                <details className="mt-4 rounded-xl bg-slate-50 p-4" open={status !== 'correct'}>
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">Solution</summary>
                  {q.solutionImageUrl ? (
                    <div className="mt-3"><PaperImage src={q.solutionImageUrl} alt="Solution" onZoom={() => setZoom(q.solutionImageUrl)} /></div>
                  ) : <p className="mt-2 text-sm"><Rich html={q.solution} /></p>}
                </details>
              )}
              {q.note && <p className="mt-3 text-xs text-amber-700">Note: {q.note}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center gap-2">
        <Link href="/dashboard" className="btn-primary">Take another test</Link>
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 overflow-auto bg-slate-900/80 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="mx-auto w-full max-w-4xl rounded-lg bg-white" />
        </div>
      )}
    </div>
  );
}

const Box = ({ l, v, c = '' }: { l: string; v: string | number; c?: string }) => (
  <div className="p-4 text-center"><div className={`text-xl font-bold ${c}`}>{v}</div><div className="text-xs text-slate-500">{l}</div></div>
);

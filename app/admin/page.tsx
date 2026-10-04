'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/pb';
import { SUBJECT_STYLE, fmtDate } from '@/components/format';
import StatusPill from '@/components/StatusPill';

interface Overview {
  published: number; drafts: number; students: number; attempts: number; avgScorePct: number | null;
  bySubject: Record<string, number>;
  papers: { id: string; title: string; exam: string; year: number; status: string; created: string; published: number; drafts: number }[];
}

export default function AdminHome() {
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<Overview>('/api/admin/overview').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>;
  if (!d) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile l="Live questions" v={d.published} />
        <Tile l="Drafts to review" v={d.drafts} hi={d.drafts > 0} />
        <Tile l="Students" v={d.students} />
        <Tile l="Tests taken" v={d.attempts} sub={d.avgScorePct !== null ? `avg score ${d.avgScorePct}%` : undefined} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {Object.entries(d.bySubject).map(([s, n]) => (
          <div key={s} className={`rounded-2xl p-4 ${SUBJECT_STYLE[s]?.bg}`}>
            <div className={`text-sm font-semibold ${SUBJECT_STYLE[s]?.text}`}>{s}</div>
            <div className="text-2xl font-bold">{n}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Papers</h2>
        <Link href="/admin/upload" className="btn-primary !py-2">+ Upload PDF</Link>
      </div>
      <div className="card mt-3 divide-y divide-slate-100">
        {d.papers.length === 0 && <p className="p-6 text-sm text-slate-500">No papers yet.</p>}
        {d.papers.map((p) => (
          <Link key={p.id} href={`/admin/papers/${p.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.title}</div>
              <div className="text-xs text-slate-500">{p.exam} {p.year} · added {fmtDate(p.created)}</div>
            </div>
            <span className="text-sm text-slate-600">{p.published} live</span>
            {p.drafts > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{p.drafts} drafts</span>}
            <StatusPill s={p.status} />
            <span className="text-slate-300">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const Tile = ({ l, v, sub, hi }: { l: string; v: number; sub?: string; hi?: boolean }) => (
  <div className={`card p-4 ${hi ? 'border-amber-300 bg-amber-50' : ''}`}>
    <div className="text-xs text-slate-500">{l}</div>
    <div className="mt-1 text-2xl font-bold">{v}</div>
    {sub && <div className="text-xs text-slate-500">{sub}</div>}
  </div>
);


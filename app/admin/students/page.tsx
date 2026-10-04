'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/pb';
import { fmtDate } from '@/components/format';

interface Student { id: string; name: string; email: string; role: string; joined: string; tests: number; accuracy: number | null; avgScorePct: number | null; lastActive: string | null }

export default function Students() {
  const [list, setList] = useState<Student[] | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { api<{ students: Student[] }>('/api/admin/students').then((r) => setList(r.students)).catch((e) => setErr(e.message)); }, []);
  const shown = useMemo(() => (list || []).filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(q.toLowerCase())), [list, q]);
  if (err) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>;
  if (!list) return <p className="text-slate-500">Loading…</p>;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">{list.length} users</h2>
        <input className="input max-w-xs" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="p-3">Name</th><th className="p-3">Tests</th><th className="p-3">Accuracy</th><th className="p-3">Avg score</th><th className="p-3">Last active</th><th className="p-3">Joined</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((s) => (
              <tr key={s.id}>
                <td className="p-3">
                  <div className="font-medium">{s.name || '—'} {s.role === 'admin' && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700">admin</span>}</div>
                  <div className="text-xs text-slate-500">{s.email}</div>
                </td>
                <td className="p-3">{s.tests}</td>
                <td className="p-3">{s.accuracy === null ? '—' : `${s.accuracy}%`}</td>
                <td className="p-3">{s.avgScorePct === null ? '—' : `${s.avgScorePct}%`}</td>
                <td className="p-3 text-slate-600">{s.lastActive ? fmtDate(s.lastActive) : '—'}</td>
                <td className="p-3 text-slate-600">{fmtDate(s.joined)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

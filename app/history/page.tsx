'use client';
import { C } from '@/lib/collections';
import { useEffect, useState } from 'react';
import type { RecordModel } from 'pocketbase';
import { pb } from '@/lib/pb';
import { useAuth } from '@/components/useAuth';
import AttemptList from '@/components/AttemptList';

export default function History() {
  const { user } = useAuth();
  const [items, setItems] = useState<RecordModel[] | null>(null);
  useEffect(() => {
    if (!user) return;
    pb().collection(C.attempts).getFullList({ filter: 'submitted_at != ""', sort: '-submitted_at', fields: 'id,mode,subject,score,correct,wrong,skipped,total,submitted_at' })
      .then(setItems).catch(() => setItems([]));
  }, [user]);
  if (!user) return null;

  const totals = (items || []).reduce((t, a) => ({ tests: t.tests + 1, q: t.q + a.total, c: t.c + a.correct, w: t.w + a.wrong }), { tests: 0, q: 0, c: 0, w: 0 });
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">My tests</h1>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[['Tests', totals.tests], ['Questions attempted', totals.c + totals.w], ['Accuracy', totals.c + totals.w ? `${Math.round((totals.c / (totals.c + totals.w)) * 100)}%` : '—']].map(([l, v]) => (
          <div key={l} className="card p-4"><div className="text-xs text-slate-500">{l}</div><div className="mt-1 text-xl font-bold">{v}</div></div>
        ))}
      </div>
      {items === null ? <p className="mt-6 text-slate-500">Loading…</p>
        : items.length === 0 ? <p className="card mt-6 p-6 text-sm text-slate-500">No tests yet.</p>
        : <AttemptList items={items} />}
    </div>
  );
}

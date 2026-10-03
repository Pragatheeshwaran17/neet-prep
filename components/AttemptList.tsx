import Link from 'next/link';
import type { RecordModel } from 'pocketbase';
import { SUBJECT_STYLE, fmtDate } from './format';

export default function AttemptList({ items }: { items: RecordModel[] }) {
  return (
    <div className="card mt-3 divide-y divide-slate-100">
      {items.map((a) => {
        const max = a.total * 4, pct = max ? Math.max(0, Math.round((a.score / max) * 100)) : 0, sty = SUBJECT_STYLE[a.subject] || SUBJECT_STYLE['Mock test'];
        return (
          <Link key={a.id} href={`/results/${a.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${sty.bg} ${sty.text}`}>{sty.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{a.subject} · {a.total} questions</div>
              <div className="text-xs text-slate-500">{fmtDate(a.submitted_at)} · ✓ {a.correct} ✗ {a.wrong} – {a.skipped}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">{a.score}<span className="text-xs font-normal text-slate-400">/{max}</span></div>
              <div className="text-xs text-slate-500">{pct}%</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}


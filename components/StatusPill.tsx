export default function StatusPill({ s }: { s: string }) {
  const c = s === 'published' ? 'bg-emerald-100 text-emerald-800' : s === 'parsing' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${c}`}>{s === 'review' ? 'in review' : s}</span>;
}

export const fmtDuration = (sec: number) => {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
};

export const fmtClock = (sec: number) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export const SUBJECT_STYLE: Record<string, { bg: string; text: string; ring: string; icon: string }> = {
  Physics: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200', icon: '⚛' },
  Chemistry: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', icon: '⚗' },
  Biology: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', icon: '🧬' },
  'Mock test': { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200', icon: '◎' },
  'Full paper': { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', icon: '▤' },
};

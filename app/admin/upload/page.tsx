'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, pb } from '@/lib/pb';
import { loadPdf, PageRenderer, parsePdf, type ParseResult } from '@/lib/pdf-parse';
import { SUBJECT_STYLE } from '@/components/format';

interface PaperOpt { id: string; title: string }
type Step = 'choose' | 'reading' | 'ready' | 'importing' | 'done';

export default function UploadPage() {
  const [mode, setMode] = useState<'new' | 'update'>('new');
  const [papers, setPapers] = useState<PaperOpt[]>([]);
  const [target, setTarget] = useState('');
  const [form, setForm] = useState({ title: '', exam: 'NEET', year: String(new Date().getFullYear()) });
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('choose');
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [result, setResult] = useState<ParseResult | null>(null);
  const [preview, setPreview] = useState<{ q: string | null; s: string | null }>({ q: null, s: null });
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<number[]>([]);
  const [paperId, setPaperId] = useState<string | null>(null);
  const pdfRef = useRef<any>(null);
  const rendererRef = useRef<PageRenderer | null>(null);

  useEffect(() => {
    api<{ papers: PaperOpt[] }>('/api/admin/overview').then((r) => { setPapers(r.papers); if (r.papers[0]) setTarget(r.papers[0].id); }).catch(() => {});
  }, []);

  async function read(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError('Choose a PDF file');
    setError(''); setResult(null); setStep('reading');
    try {
      const pdf = await loadPdf(await file.arrayBuffer());
      pdfRef.current = pdf;
      rendererRef.current = new PageRenderer(pdf);
      const r = await parsePdf(pdf, (p, t) => setProgress({ done: p, total: t, label: `Reading page ${p} of ${t}` }));
      setResult(r);
      if (r.questions[0]) {
        const q = r.questions[0];
        const qb = await rendererRef.current.crop(q.question, q.numberBox);
        const sb = await rendererRef.current.crop(q.solution);
        setPreview({ q: qb && URL.createObjectURL(qb), s: sb && URL.createObjectURL(sb) });
      }
      setStep('ready');
    } catch (err: any) {
      setError(/password|encrypt/i.test(err?.message) ? 'This PDF is password-protected.' : err?.message || 'Could not read this PDF');
      setStep('choose');
    }
  }

  async function runImport(onlyNumbers?: number[]) {
    if (!result || !rendererRef.current) return;
    setError(''); setStep('importing');
    try {
      let pid = paperId;
      const updating = mode === 'update';
      if (!pid) {
        if (updating) pid = target;
        else {
          const fd = new FormData();
          fd.set('title', form.title); fd.set('exam', form.exam); fd.set('year', form.year); fd.set('pdf', file!);
          const res = await fetch('/api/admin/papers', { method: 'POST', headers: { Authorization: pb().authStore.token }, body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Could not create paper');
          pid = data.id;
        }
        setPaperId(pid);
      }
      const list = result.questions.filter((q) => !onlyNumbers || onlyNumbers.includes(q.number));
      const bad: number[] = [];
      const inflight = new Set<Promise<void>>();
      let done = 0;
      for (const q of list) {
        setProgress({ done, total: list.length, label: `Cropping Q${q.number}` });
        const qImg = await rendererRef.current.crop(q.question, q.numberBox);
        const sImg = await rendererRef.current.crop(q.solution);
        const fd = new FormData();
        fd.set('paper', pid!);
        fd.set('number', String(q.number));
        fd.set('subject', q.subject);
        fd.set('question', q.text);
        fd.set('display', 'image');
        fd.set('page', String(q.question[0]?.page || 0));
        if (q.answer) { fd.set('answer', String(q.answer)); fd.set('note', q.answerNote); }
        else if (!updating) { fd.set('answer', ''); fd.set('note', q.answerNote); }
        if (!updating) { fd.set('options', '["","","",""]'); fd.set('solution', ''); }
        const ext = (b: Blob) => (b.type === 'image/webp' ? 'webp' : 'png');
        if (qImg) fd.set('question_image', qImg, `q${q.number}.${ext(qImg)}`);
        if (sImg) fd.set('solution_image', sImg, `s${q.number}.${ext(sImg)}`);
        const job = (async () => {
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const res = await fetch('/api/admin/questions', { method: 'POST', headers: { Authorization: pb().authStore.token }, body: fd });
              if (res.ok) return;
              if (attempt === 3) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
            } catch (e) { if (attempt === 3) { bad.push(q.number); return; } }
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        })().finally(() => { done++; setProgress({ done, total: list.length, label: `Saved Q${q.number}` }); });
        inflight.add(job);
        job.finally(() => inflight.delete(job));
        if (inflight.size >= 4) await Promise.race(inflight);
      }
      await Promise.all(inflight);
      setFailed(bad.sort((a, b) => a - b));
      if (!updating) await api(`/api/admin/papers/${pid}`, { method: 'PATCH', body: JSON.stringify({ status: 'review', question_count: result.questions.length }) });
      setStep('done');
    } catch (err: any) { setError(err.message); setStep('ready'); }
  }

  const bySubject = result ? result.questions.reduce<Record<string, number>>((a, q) => ({ ...a, [q.subject]: (a[q.subject] || 0) + 1 }), {}) : {};
  const busy = step === 'reading' || step === 'importing';
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <form onSubmit={read} className="card h-fit space-y-4 p-5">
        <h2 className="text-lg font-semibold">Upload a question paper</h2>
        <p className="text-sm text-slate-600">
          The PDF is read in your browser — no AI. Every question and solution is saved exactly as printed (English, Hindi, formulas and diagrams).
        </p>
        <div className="flex overflow-hidden rounded-xl ring-1 ring-slate-200">
          {(['new', 'update'] as const).map((m) => (
            <button type="button" key={m} disabled={busy} onClick={() => { setMode(m); setPaperId(null); }}
              className={`flex-1 px-3 py-2 text-sm font-semibold ${mode === m ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
              {m === 'new' ? 'New paper' : 'Refresh existing paper'}
            </button>
          ))}
        </div>
        {mode === 'new' ? (
          <>
            <div>
              <label className="label" htmlFor="title">Title</label>
              <input id="title" className="input" required placeholder="NEET 2023 Paper" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={busy} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="exam">Exam</label>
                <select id="exam" className="input" value={form.exam} onChange={(e) => setForm({ ...form, exam: e.target.value })} disabled={busy}><option>NEET</option><option>JEE</option></select>
              </div>
              <div>
                <label className="label" htmlFor="year">Year</label>
                <input id="year" className="input" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} disabled={busy} />
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className="label" htmlFor="target">Paper to refresh</label>
            <select id="target" className="input" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
              {papers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">Re-cuts every question&apos;s images from the PDF. Answers you already set and publish status are kept.</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="pdf">PDF file</label>
          <input id="pdf" type="file" accept="application/pdf" disabled={busy}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setStep('choose'); setResult(null); setPaperId(null); }} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !file || (mode === 'update' && !target)}>
          {step === 'reading' ? 'Reading…' : 'Read PDF'}
        </button>
      </form>

      <div className="min-w-0 space-y-4">
        {step === 'choose' && (
          <div className="card grid min-h-60 place-items-center p-8 text-center text-sm text-slate-500">
            <div><div className="text-3xl">📄</div><p className="mt-2">Choose a PDF and click <b>Read PDF</b>. You&apos;ll see what was found before anything is saved.</p></div>
          </div>
        )}

        {busy && (
          <div className="card p-5">
            <div className="text-sm font-medium">{progress.label || 'Working…'}</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-xs text-slate-500">{step === 'importing' ? `${progress.done} / ${progress.total} saved — keep this tab open.` : 'Nothing is saved yet.'}</p>
          </div>
        )}

        {result && step !== 'reading' && (
          <div className="card p-5">
            <div className="flex flex-wrap items-baseline gap-x-4">
              <div className="text-2xl font-bold">{result.questions.length} <span className="text-base font-medium text-slate-500">questions found</span></div>
              <div className="text-sm text-slate-500">{result.pages} pages</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(bySubject).map(([s, n]) => (
                <span key={s} className={`rounded-full px-3 py-1 text-sm font-semibold ${SUBJECT_STYLE[s]?.bg} ${SUBJECT_STYLE[s]?.text}`}>{s}: {n}</span>
              ))}
            </div>
            {result.warnings.map((w, i) => <p key={i} className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">⚠ {w}</p>)}
            {preview.q && (
              <div className="mt-5">
                <div className="label">Preview — question {result.questions[0].number}, as students will see it</div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.q} alt="" className="max-w-none" style={{ width: 'min(100%, 720px)' }} />
                </div>
                {preview.s && (
                  <>
                    <div className="label mt-3">Its answer &amp; solution (shown only after submitting)</div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview.s} alt="" className="max-w-none" style={{ width: 'min(100%, 720px)' }} />
                    </div>
                  </>
                )}
              </div>
            )}
            {step === 'ready' && result.questions.length > 0 && (
              <button className="btn-primary mt-5" onClick={() => runImport()}>
                {mode === 'new' ? `Save ${result.questions.length} questions as drafts` : `Refresh ${result.questions.length} questions`}
              </button>
            )}
            {step === 'done' && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-4">
                <span className="text-sm font-medium text-emerald-900">
                  {mode === 'new' ? 'Saved as drafts.' : 'Images refreshed.'} {failed.length ? `${failed.length} failed: Q${failed.join(', Q')}` : 'All questions saved.'}
                </span>
                {failed.length > 0 && <button className="btn-ghost !py-2" onClick={() => runImport(failed)}>Retry failed</button>}
                {paperId && <Link href={`/admin/papers/${paperId}`} className="btn-primary ml-auto !py-2">{mode === 'new' ? 'Review & publish →' : 'Open paper →'}</Link>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';
/**
 * Reads a question-paper PDF in the browser — no AI.
 * Finds question numbers, "Ans." and "Sol." markers and "PART – SUBJECT" headings from the
 * PDF's own text positions, then cuts each question and solution out of the page as a
 * high-resolution image (English, Hindi, formulas and diagrams exactly as printed).
 */

export const RENDER_SCALE = 3; // 3× = ~216 dpi, sharp on phones

export interface Region { page: number; top: number; bottom: number }  // PDF points, top-down
export interface ParsedQuestion {
  number: number;
  subject: string;
  answer: number | null;
  answerNote: string;
  text: string;                    // English text, for admin search only
  question: Region[];
  solution: Region[];
  numberBox: { page: number; x0: number; y0: number; x1: number; y1: number } | null;
}
export interface ParseResult {
  pages: number;
  questions: ParsedQuestion[];
  warnings: string[];
}

interface Item { str: string; x: number; y: number; w: number; size: number; bold: boolean; legacyHindi: boolean }
interface Line { page: number; y: number; top: number; items: Item[]; text: string }

const SUBJECTS: Record<string, string> = {
  PHYSICS: 'Physics', CHEMISTRY: 'Chemistry', BIOLOGY: 'Biology', BOTANY: 'Biology', ZOOLOGY: 'Biology',
  MATHEMATICS: 'Mathematics', MATHS: 'Mathematics',
};
const LEFT_COLUMN = 68;     // question numbers / Ans. / Sol. sit left of this x (points)
const HINDI_FONT = /narad|kruti|dev|chanakya|shusha|walkman|aps-|mangal_legacy/i;

export async function loadPdf(data: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
}

async function readLines(pdf: any, pageNo: number): Promise<{ lines: Line[]; height: number; width: number; footerTop: number }> {
  const page = await pdf.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  await page.getOperatorList(); // makes real font names available
  const tc = await page.getTextContent();
  const fontName = (id: string) => { try { return page.commonObjs.get(id)?.name || ''; } catch { return ''; } };
  const items: Item[] = [];
  for (const it of tc.items as any[]) {
    if (!it.str || !it.str.trim()) continue;
    const [, , c, d, e, f] = it.transform;
    const [x, y] = vp.convertToViewportPoint(e, f);
    const name = fontName(it.fontName);
    items.push({ str: it.str, x, y, w: it.width, size: Math.hypot(c, d) || it.height || 10, bold: /bold|black|heavy/i.test(name), legacyHindi: HINDI_FONT.test(name) });
  }
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of items) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) < 3) last.items.push(it);
    else lines.push({ page: pageNo, y: it.y, top: it.y - it.size, items: [it], text: '' });
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.top = Math.min(...l.items.map((i) => i.y - i.size * 0.9));
    l.text = l.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
  }
  // page number footer: a lone number near the bottom
  let footerTop = vp.height - 25;
  for (const l of lines) if (l.y > vp.height - 70 && /^\d{1,3}$/.test(l.text)) footerTop = Math.min(footerTop, l.top - 4);
  return { lines, height: vp.height, width: vp.width, footerTop };
}

export async function parsePdf(pdf: any, onProgress?: (page: number, total: number) => void): Promise<ParseResult> {
  const warnings: string[] = [];
  type Mark = { kind: 'q' | 'ans' | 'sol' | 'part'; page: number; top: number; num?: number; subject?: string; line: Line; numItem?: Item };
  const marks: Mark[] = [];
  const pageInfo: { footerTop: number; height: number }[] = [];
  const allLines: Line[] = [];
  let expected = 0;
  let subject = '';

  for (let p = 1; p <= pdf.numPages; p++) {
    const { lines, footerTop, height } = await readLines(pdf, p);
    pageInfo[p] = { footerTop, height };
    for (const l of lines) {
      if (l.top >= footerTop) continue;
      allLines.push(l);
      const first = l.items[0];
      // subject headings: "PART A – CHEMISTRY", "CHEMISTRY", "SECTION-B : PHYSICS"
      const head = l.text.toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
      const subj = Object.keys(SUBJECTS).find((k) => head === k || new RegExp(`^(PART|SECTION) [A-Z]{1,2} ${k}$`).test(head) || head.endsWith(` ${k}`) && head.split(' ').length <= 4);
      if (subj && l.items.some((i) => i.bold) && l.items.length <= 6) {
        subject = SUBJECTS[subj];
        marks.push({ kind: 'part', page: p, top: l.top, subject, line: l });
        continue;
      }
      if (first.x > LEFT_COLUMN) continue;
      const t = first.str.trim();
      const qm = t.match(/^(\d{1,3})\.?$/);
      if (qm && (first.bold || l.items.length > 1)) {
        const n = Number(qm[1]);
        const ok = expected === 0 || n === expected + 1 || (n === 1 && marks.at(-1)?.kind === 'part');
        if (ok) {
          marks.push({ kind: 'q', page: p, top: l.top, num: n, subject, line: l, numItem: first });
          expected = n;
          continue;
        }
      }
      if (/^Ans\b/i.test(t)) marks.push({ kind: 'ans', page: p, top: l.top, line: l });
      else if (/^Sol\b/i.test(t)) marks.push({ kind: 'sol', page: p, top: l.top, line: l });
    }
    onProgress?.(p, pdf.numPages);
  }

  const lastPage = pdf.numPages;
  const endPos = { page: lastPage, top: pageInfo[lastPage].footerTop };
  const regionsBetween = (a: { page: number; top: number }, b: { page: number; top: number }): Region[] => {
    const out: Region[] = [];
    for (let p = a.page; p <= b.page; p++) {
      const top = p === a.page ? a.top : 28;
      const bottom = p === b.page ? b.top : pageInfo[p].footerTop;
      if (bottom - top > 6) out.push({ page: p, top, bottom });
    }
    return out;
  };

  const qMarks = marks.filter((m) => m.kind === 'q');
  const questions: ParsedQuestion[] = [];
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    if (m.kind !== 'q') continue;
    let j = i + 1;
    while (j < marks.length && marks[j].kind !== 'q' && marks[j].kind !== 'part') j++;
    const next = j < marks.length ? { page: marks[j].page, top: marks[j].top - 4 } : endPos;
    const own = marks.slice(i + 1, j);
    const ans = own.find((x) => x.kind === 'ans');
    const sol = own.find((x) => x.kind === 'sol');
    const qEnd = ans || sol ? { page: (ans || sol)!.page, top: (ans || sol)!.top - 3 } : next;
    const start = { page: m.page, top: m.top - 4 };
    let answer: number | null = null;
    let answerNote = '';
    if (ans) {
      const rest = ans.line.text.replace(/^Ans\.?/i, '');
      const am = rest.match(/\(\s*([1-4])\b/) || rest.match(/^\s*([1-4])\b/);
      if (am) answer = Number(am[1]);
      if (/bonus/i.test(rest)) answerNote = `Source PDF lists answer as "${rest.trim()}".`;
    }
    if (!answer) answerNote ||= 'No answer found in the PDF — set it before publishing.';
    const solStart = ans || sol;
    const text = allLines
      .filter((l) => (l.page > start.page || (l.page === start.page && l.top >= start.top)) && (l.page < qEnd.page || (l.page === qEnd.page && l.top < qEnd.top)))
      .map((l) => l.items.filter((it) => !it.legacyHindi).map((it) => it.str).join(' '))
      .join(' ').replace(/^\s*\d{1,3}\.\s*/, '').replace(/\s+/g, ' ').trim();
    const ni = m.numItem!;
    questions.push({
      number: m.num!,
      subject: m.subject || 'Physics',
      answer,
      answerNote,
      text,
      question: regionsBetween(start, qEnd),
      solution: solStart ? regionsBetween({ page: solStart.page, top: solStart.top - 3 }, next) : [],
      numberBox: { page: m.page, x0: ni.x - 2, y0: ni.y - ni.size - 1, x1: ni.x + ni.w + 3, y1: ni.y + 3 },
    });
    if (!m.subject) warnings.push(`Q${m.num}: no subject heading found before it — set to Physics, please check.`);
  }
  if (!qMarks.length) warnings.push('No questions found. Is this a scanned PDF, or a layout without "1." numbers in the left margin?');
  const missing = questions.filter((q) => !q.answer).map((q) => q.number);
  if (missing.length) warnings.push(`${missing.length} question(s) have no "Ans." in the PDF: ${missing.slice(0, 15).join(', ')}${missing.length > 15 ? '…' : ''}`);
  return { pages: pdf.numPages, questions, warnings };
}

/* ---------------- cropping ---------------- */

export class PageRenderer {
  private cache = new Map<number, HTMLCanvasElement>();
  constructor(private pdf: any, private scale = RENDER_SCALE) {}
  async page(n: number): Promise<HTMLCanvasElement> {
    const hit = this.cache.get(n);
    if (hit) return hit;
    const page = await this.pdf.getPage(n);
    const vp = page.getViewport({ scale: this.scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
    this.cache.set(n, canvas);
    if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value!); // keep memory low
    return canvas;
  }

  /** Cuts the regions out, stitches across pages, removes the printed number, trims blank space */
  async crop(regions: Region[], blank?: ParsedQuestion['numberBox']): Promise<Blob | null> {
    if (!regions.length) return null;
    const s = this.scale;
    const parts: HTMLCanvasElement[] = [];
    for (const r of regions) {
      const src = await this.page(r.page);
      const x0 = Math.round(38 * s), x1 = Math.round(src.width - 16 * s);
      const y0 = Math.max(0, Math.round(r.top * s)), y1 = Math.min(src.height, Math.round(r.bottom * s));
      if (y1 - y0 < 4) continue;
      const c = document.createElement('canvas');
      c.width = x1 - x0; c.height = y1 - y0;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
      if (blank && blank.page === r.page) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(blank.x0 * s - x0, blank.y0 * s - y0, (blank.x1 - blank.x0) * s, (blank.y1 - blank.y0) * s);
      }
      parts.push(c);
    }
    if (!parts.length) return null;
    const out = squeeze(parts);
    if (!out) return null;
    return new Promise((res) => out.toBlob((b) => res(b), 'image/webp', 0.85));
  }
}

/** Stack parts vertically, drop leading/trailing blank rows, shrink big blank gaps, trim right margin */
function squeeze(parts: HTMLCanvasElement[]): HTMLCanvasElement | null {
  const w = Math.max(...parts.map((p) => p.width));
  const h = parts.reduce((a, p) => a + p.height, 0);
  const all = document.createElement('canvas');
  all.width = w; all.height = h;
  const actx = all.getContext('2d')!;
  actx.fillStyle = '#fff'; actx.fillRect(0, 0, w, h);
  let y = 0;
  for (const p of parts) { actx.drawImage(p, 0, y); y += p.height; }
  const data = actx.getImageData(0, 0, w, h).data;
  const ink = new Uint8Array(h);
  let right = 0, left = w;
  for (let r = 0; r < h; r++) {
    const row = r * w * 4;
    for (let c = 0; c < w; c++) {
      const i = row + c * 4;
      if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) { ink[r] = 1; if (c > right) right = c; if (c < left) left = c; }
    }
  }
  const first = ink.indexOf(1);
  if (first < 0) return null;
  const last = ink.lastIndexOf(1);
  const maxGap = 60; // px at 3× ≈ 20pt
  const keep: number[] = [];
  let gap = 0;
  for (let r = Math.max(0, first - 12); r <= Math.min(h - 1, last + 12); r++) {
    if (ink[r]) { gap = 0; keep.push(r); } else if (++gap <= maxGap) keep.push(r);
  }
  const x0 = Math.max(0, left - 18);
  const outW = Math.min(w, right + 18) - x0;
  const out = document.createElement('canvas');
  out.width = outW; out.height = keep.length;
  const octx = out.getContext('2d')!;
  // copy kept rows in contiguous runs
  let runStart = 0;
  for (let k = 1; k <= keep.length; k++) {
    if (k === keep.length || keep[k] !== keep[k - 1] + 1) {
      const srcY = keep[runStart], len = k - runStart;
      octx.drawImage(all, x0, srcY, outW, len, 0, runStart, outW, len);
      runStart = k;
    }
  }
  return out;
}

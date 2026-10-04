import 'server-only';
import { SUBJECTS } from './types';

/** Validates admin question form fields and returns a FormData ready for PocketBase */
export function cleanQuestionForm(form: FormData, creating: boolean): FormData {
  const out = new FormData();
  const str = (k: string) => (form.has(k) ? String(form.get(k) ?? '') : null);
  const set = (k: string, v: string | null) => { if (v !== null) out.set(k, v); };

  set('paper', str('paper'));
  if (form.has('number')) out.set('number', String(Math.max(1, Number(form.get('number')) || 1)));
  const subject = str('subject');
  if (subject !== null) out.set('subject', [...SUBJECTS, 'Mathematics'].includes(subject) ? subject : 'Physics');
  set('question', str('question'));
  if (form.has('options')) {
    let opts: unknown = [];
    try { opts = JSON.parse(String(form.get('options'))); } catch {}
    const arr = Array.isArray(opts) ? opts : [];
    out.set('options', JSON.stringify([0, 1, 2, 3].map((i) => String(arr[i] ?? ''))));
  }
  if (form.has('answer')) {
    const a = Number(form.get('answer'));
    out.set('answer', a >= 1 && a <= 4 ? String(a) : '');
  }
  set('solution', str('solution'));
  const display = str('display');
  if (display !== null) out.set('display', display === 'image' ? 'image' : 'text');
  set('note', str('note'));
  if (form.has('page')) out.set('page', String(Number(form.get('page')) || 0));
  const status = str('status');
  if (status !== null) out.set('status', status === 'published' ? 'published' : 'draft');
  else if (creating) out.set('status', 'draft');

  for (const f of ['question_image', 'solution_image']) {
    const file = form.get(f);
    if (file instanceof File && file.size) out.set(f, file);
    else if (form.get(`remove_${f}`) === '1') out.set(f, '');
  }
  return out;
}

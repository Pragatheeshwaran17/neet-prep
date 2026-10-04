import { C } from '@/lib/collections';
import { adminPb, handle, HttpError, requireAdmin } from '@/lib/server';

/** Create a paper (multipart: title, exam, year, pdf) */
export const POST = handle(async (req) => {
  await requireAdmin(req);
  const form = await req.formData();
  const title = String(form.get('title') || '').trim();
  if (!title) throw new HttpError(400, 'Title is required');
  const out = new FormData();
  out.set('title', title);
  out.set('exam', form.get('exam') === 'JEE' ? 'JEE' : 'NEET');
  out.set('year', String(Number(form.get('year')) || new Date().getFullYear()));
  out.set('status', 'parsing');
  const pdf = form.get('pdf');
  if (pdf instanceof File && pdf.size) out.set('pdf', pdf);
  const pb = await adminPb();
  const p = await pb.collection(C.papers).create(out);
  return { id: p.id };
});

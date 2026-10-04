import { C } from '@/lib/collections';
import { adminPb, fileUrl, handle, requireAdmin } from '@/lib/server';

export const GET = handle(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  const pb = await adminPb();
  const p = await pb.collection(C.papers).getOne(id);
  return { id: p.id, title: p.title, exam: p.exam, year: p.year, status: p.status, pdfUrl: fileUrl(p, 'pdf') };
});

export const PATCH = handle(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ['title', 'exam', 'year', 'status', 'question_count']) if (k in body) data[k] = body[k];
  const pb = await adminPb();
  await pb.collection(C.papers).update(id, data);
  return { ok: true };
});

/** Delete a paper and (cascade) all its questions */
export const DELETE = handle(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  const pb = await adminPb();
  await pb.collection(C.papers).delete(id);
  return { ok: true };
});

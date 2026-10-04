import { C } from '@/lib/collections';
import { adminPb, handle, HttpError, requireAdmin } from '@/lib/server';

/** Publish (or unpublish) questions. Body: { ids?: string[], status?: 'published'|'draft' } — no ids = all in paper */
export const POST = handle(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status === 'draft' ? 'draft' : 'published';
  const pb = await adminPb();
  const all = await pb.collection(C.questions).getFullList({ filter: `paper="${id}"`, fields: 'id,answer,status' });
  const target = Array.isArray(body.ids) ? all.filter((q) => body.ids.includes(q.id)) : all;
  if (status === 'published') {
    const missing = target.filter((q) => !q.answer).length;
    if (missing) throw new HttpError(400, `${missing} question(s) have no correct answer yet — set them before publishing`);
  }
  let changed = 0;
  for (const q of target) {
    if (q.status === status) continue;
    await pb.collection(C.questions).update(q.id, { status });
    changed++;
  }
  const published = (await pb.collection(C.questions).getList(1, 1, { filter: `paper="${id}" && status="published"`, fields: 'id' })).totalItems;
  await pb.collection(C.papers).update(id, { status: published ? 'published' : 'review', question_count: all.length });
  return { changed, published };
});

import { C } from '@/lib/collections';
import { adminPb, handle, requireAdmin, toAdmin } from '@/lib/server';

export const GET = handle(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  const pb = await adminPb();
  const qs = await pb.collection(C.questions).getFullList({ filter: `paper="${id}"`, sort: 'number' });
  return { questions: qs.map(toAdmin) };
});

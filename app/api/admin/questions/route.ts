import { C } from '@/lib/collections';
import { adminPb, handle, HttpError, requireAdmin, toAdmin } from '@/lib/server';
import { cleanQuestionForm } from '@/lib/admin-form';

/** Create a question (multipart). Fields: paper, number, subject, question, options (JSON), answer, solution, display, note, page, status, question_image, solution_image */
export const POST = handle(async (req) => {
  await requireAdmin(req);
  const form = await req.formData();
  if (!form.get('paper')) throw new HttpError(400, 'paper is required');
  const pb = await adminPb();
  // same number in the same paper = update it (re-importing a PDF refreshes images but keeps
  // the answer and publish status unless the form sends new ones)
  const existing = await pb.collection(C.questions).getList(1, 1, { filter: `paper="${form.get('paper')}" && number=${Number(form.get('number')) || 0}` });
  const out = cleanQuestionForm(form, !existing.items[0]);
  const q = existing.items[0]
    ? await pb.collection(C.questions).update(existing.items[0].id, out)
    : await pb.collection(C.questions).create(out);
  return toAdmin(q);
});

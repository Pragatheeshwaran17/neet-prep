import { C } from '@/lib/collections';
import { adminPb, handle, requireAdmin, toAdmin } from '@/lib/server';
import { cleanQuestionForm } from '@/lib/admin-form';

/** Update a question (multipart, any subset of fields). Send remove_question_image / remove_solution_image = 1 to clear. */
export const PATCH = handle(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  const form = await req.formData();
  const pb = await adminPb();
  const q = await pb.collection(C.questions).update(id, cleanQuestionForm(form, false));
  return toAdmin(q);
});

export const DELETE = handle(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  const pb = await adminPb();
  await pb.collection(C.questions).delete(id);
  return { ok: true };
});

import { C } from '@/lib/collections';
import { adminPb, handle, HttpError, questionsByIds, toPublic } from '@/lib/server';
import { deadline, ownAttempt } from '@/lib/attempts';

/** Load a test in progress (questions without answers) */
export const GET = handle(async (req, { params }) => {
  const { id } = await params;
  const a = await ownAttempt(req, id);
  const qs = await questionsByIds(a.question_ids || []);
  return {
    id: a.id,
    mode: a.mode,
    subject: a.subject,
    submitted: !!a.submitted_at,
    answers: a.answers || {},
    marked: a.marked || [],
    deadline: deadline(a),
    serverNow: Date.now(),
    questions: qs.map(toPublic),
  };
});

/** Autosave answers. Body: { answers: {qid: 1-4}, marked: [qid] } */
export const PATCH = handle(async (req, { params }) => {
  const { id } = await params;
  const a = await ownAttempt(req, id);
  if (a.submitted_at) throw new HttpError(409, 'This test is already submitted');
  const dl = deadline(a);
  if (dl && Date.now() > dl + 60_000) throw new HttpError(409, 'Time is up');
  const body = await req.json().catch(() => ({}));
  const valid = new Set<string>(a.question_ids || []);
  const answers: Record<string, number> = {};
  for (const [qid, v] of Object.entries(body.answers || {})) {
    const n = Number(v);
    if (valid.has(qid) && n >= 1 && n <= 4) answers[qid] = n;
  }
  const marked = (Array.isArray(body.marked) ? body.marked : []).filter((q: string) => valid.has(q));
  const pb = await adminPb();
  await pb.collection(C.attempts).update(a.id, { answers, marked });
  return { ok: true };
});

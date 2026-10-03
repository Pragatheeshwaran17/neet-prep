import { adminPb, handle, HttpError, questionsByIds } from '@/lib/server';
import { deadline, ownAttempt } from '@/lib/attempts';
import { MARKS } from '@/lib/types';

/** Submit and score a test. Body (optional): { answers, marked } — final save before scoring */
export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const a = await ownAttempt(req, id);
  if (a.submitted_at) return { id: a.id, alreadySubmitted: true };

  const body = await req.json().catch(() => ({}));
  const valid = new Set<string>(a.question_ids || []);
  const dl = deadline(a);
  const late = dl !== null && Date.now() > dl + 60_000;

  // take the final answers from the request unless the time limit has clearly passed
  const answers: Record<string, number> = { ...(a.answers || {}) };
  if (!late && body.answers) {
    for (const k of Object.keys(answers)) delete answers[k];
    for (const [qid, v] of Object.entries(body.answers)) {
      const n = Number(v);
      if (valid.has(qid) && n >= 1 && n <= 4) answers[qid] = n;
    }
  }

  const qs = await questionsByIds(a.question_ids || []);
  let correct = 0, wrong = 0, skipped = 0;
  for (const q of qs) {
    const chosen = answers[q.id];
    if (!chosen) skipped++;
    else if (chosen === q.answer) correct++;
    else wrong++;
  }
  const score = correct * MARKS.correct + wrong * MARKS.wrong;
  const now = new Date();
  const started = new Date(a.started_at).getTime();
  const timeTaken = Math.round(Math.min(now.getTime(), dl ?? Infinity) - started) / 1000;

  const pb = await adminPb();
  await pb.collection('attempts').update(a.id, {
    answers,
    marked: Array.isArray(body.marked) ? body.marked.filter((q: string) => valid.has(q)) : a.marked,
    correct, wrong, skipped, score,
    total: qs.length,
    time_taken: Math.max(0, Math.round(timeTaken)),
    submitted_at: now.toISOString(),
  });
  if (!valid.size) throw new HttpError(400, 'Empty test');
  return { id: a.id };
});

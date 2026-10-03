import { fileUrl, handle, HttpError, questionsByIds, toPublic } from '@/lib/server';
import { ownAttempt } from '@/lib/attempts';
import { MARKS, type ReviewQuestion } from '@/lib/types';

/** Results + full review (answers, solutions). Only after the test is submitted. */
export const GET = handle(async (req, { params }) => {
  const { id } = await params;
  const a = await ownAttempt(req, id);
  if (!a.submitted_at) throw new HttpError(403, 'Submit the test to see answers');
  const qs = await questionsByIds(a.question_ids || []);
  const answers: Record<string, number> = a.answers || {};
  const questions: ReviewQuestion[] = qs.map((q) => ({
    ...toPublic(q),
    answer: q.answer,
    solution: q.solution || '',
    solutionImageUrl: fileUrl(q, 'solution_image'),
    note: q.note || '',
    chosen: answers[q.id] ?? null,
  }));

  const bySubject: Record<string, { total: number; correct: number; wrong: number; skipped: number; score: number }> = {};
  for (const q of questions) {
    const s = (bySubject[q.subject] ||= { total: 0, correct: 0, wrong: 0, skipped: 0, score: 0 });
    s.total++;
    if (!q.chosen) s.skipped++;
    else if (q.chosen === q.answer) { s.correct++; s.score += MARKS.correct; }
    else { s.wrong++; s.score += MARKS.wrong; }
  }

  return {
    id: a.id,
    mode: a.mode,
    subject: a.subject,
    score: a.score,
    correct: a.correct,
    wrong: a.wrong,
    skipped: a.skipped,
    total: questions.length,
    maxScore: questions.length * MARKS.correct,
    time_taken: a.time_taken,
    submitted_at: a.submitted_at,
    bySubject,
    questions,
  };
});

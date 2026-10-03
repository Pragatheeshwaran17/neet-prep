import { adminPb, handle, HttpError, requireUser, shuffle } from '@/lib/server';
import { SECONDS_PER_QUESTION, SUBJECTS } from '@/lib/types';

/** Start a new test. Body: { mode: 'subject'|'mock'|'paper', subject?, count?, timed? } */
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const mode = ['subject', 'mock', 'paper'].includes(body.mode) ? body.mode : 'subject';
  const timed = body.timed !== false;
  const pb = await adminPb();

  let ids: string[] = [];
  let subject = '';
  let paper = '';

  if (mode === 'paper') {
    const p = body.paper
      ? await pb.collection('papers').getOne(String(body.paper))
      : await pb.collection('papers').getFirstListItem('status="published"', { sort: '-created' });
    paper = p.id;
    const qs = await pb.collection('questions').getFullList({ filter: `paper="${p.id}" && status="published"`, sort: 'number', fields: 'id' });
    ids = qs.map((q) => q.id);
    subject = 'Full paper';
  } else if (mode === 'subject') {
    if (!SUBJECTS.includes(body.subject)) throw new HttpError(400, 'Pick a subject');
    subject = body.subject;
    const count = Math.min(Math.max(Number(body.count) || 20, 5), 200);
    let pool = await pb.collection('questions').getFullList({ filter: `subject="${subject}" && status="published"`, fields: 'id' });
    let poolIds = pool.map((q) => q.id);
    if (body.freshOnly) {
      const seen = new Set<string>();
      const past = await pb.collection('attempts').getFullList({ filter: `user="${user.id}"`, fields: 'question_ids' });
      past.forEach((a) => (a.question_ids || []).forEach((id: string) => seen.add(id)));
      const fresh = poolIds.filter((id) => !seen.has(id));
      if (fresh.length >= 5) poolIds = fresh;
    }
    ids = shuffle(poolIds).slice(0, count);
  } else {
    // mock: NEET pattern ratio 45 Physics : 45 Chemistry : 90 Biology, scaled to requested size
    const size = Math.min(Math.max(Number(body.count) || 60, 20), 180);
    const share = { Physics: 0.25, Chemistry: 0.25, Biology: 0.5 } as const;
    for (const s of SUBJECTS) {
      const pool = await pb.collection('questions').getFullList({ filter: `subject="${s}" && status="published"`, fields: 'id' });
      ids.push(...shuffle(pool.map((q) => q.id)).slice(0, Math.round(size * share[s])));
    }
    subject = 'Mock test';
  }

  if (!ids.length) throw new HttpError(404, 'No questions available yet');

  const attempt = await pb.collection('attempts').create({
    user: user.id,
    mode,
    subject,
    ...(paper && { paper }),
    question_ids: ids,
    answers: {},
    marked: [],
    total: ids.length,
    duration_sec: timed ? ids.length * SECONDS_PER_QUESTION : 0,
    started_at: new Date().toISOString(),
  });
  return { id: attempt.id };
});

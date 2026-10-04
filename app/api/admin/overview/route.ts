import { C } from '@/lib/collections';
import { adminPb, handle, requireAdmin } from '@/lib/server';
import { SUBJECTS } from '@/lib/types';

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const pb = await adminPb();
  const count = async (col: string, filter = '') => (await pb.collection(col).getList(1, 1, { filter, fields: 'id' })).totalItems;
  const [published, drafts, students, attempts] = await Promise.all([
    count('questions', 'status="published"'),
    count('questions', 'status="draft"'),
    count('users', 'role!="admin"'),
    count('attempts', 'submitted_at!=""'),
  ]);
  const bySubject = Object.fromEntries(await Promise.all(SUBJECTS.map(async (s) => [s, await count('questions', `status="published" && subject="${s}"`)])));
  const papers = await pb.collection(C.papers).getFullList({ sort: '-created' });
  const paperStats = await Promise.all(papers.map(async (p) => ({
    id: p.id, title: p.title, exam: p.exam, year: p.year, status: p.status, created: p.created,
    published: await count('questions', `paper="${p.id}" && status="published"`),
    drafts: await count('questions', `paper="${p.id}" && status="draft"`),
  })));
  const recent = await pb.collection(C.attempts).getList(1, 300, { filter: 'submitted_at!=""', fields: 'score,total' });
  const avg = recent.items.length ? Math.round((recent.items.reduce((s, a) => s + (a.total ? a.score / (a.total * 4) : 0), 0) / recent.items.length) * 100) : null;
  return { published, drafts, students, attempts, avgScorePct: avg, bySubject, papers: paperStats };
});

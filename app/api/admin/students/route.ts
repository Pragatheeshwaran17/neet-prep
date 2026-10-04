import { C } from '@/lib/collections';
import { adminPb, handle, requireAdmin } from '@/lib/server';

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const pb = await adminPb();
  const users = await pb.collection(C.users).getFullList({ sort: '-created', fields: 'id,name,email,role,created' });
  const attempts = await pb.collection(C.attempts).getFullList({ filter: 'submitted_at!=""', fields: 'user,score,total,correct,wrong,submitted_at' });
  const by = new Map<string, typeof attempts>();
  attempts.forEach((a) => by.set(a.user, [...(by.get(a.user) || []), a]));
  return {
    students: users.map((u) => {
      const mine = by.get(u.id) || [];
      const answered = mine.reduce((s, a) => s + a.correct + a.wrong, 0);
      const correct = mine.reduce((s, a) => s + a.correct, 0);
      const last = mine.map((a) => a.submitted_at).sort().pop() || null;
      return {
        id: u.id, name: u.name, email: u.email, role: u.role || 'student', joined: u.created,
        tests: mine.length,
        accuracy: answered ? Math.round((correct / answered) * 100) : null,
        avgScorePct: mine.length ? Math.round((mine.reduce((s, a) => s + (a.total ? Math.max(0, a.score) / (a.total * 4) : 0), 0) / mine.length) * 100) : null,
        lastActive: last,
      };
    }),
  };
});

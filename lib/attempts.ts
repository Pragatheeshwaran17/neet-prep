import 'server-only';
import type { RecordModel } from 'pocketbase';
import { adminPb, HttpError, requireUser } from './server';

export async function ownAttempt(req: Request, id: string): Promise<RecordModel> {
  const user = await requireUser(req);
  const pb = await adminPb();
  const a = await pb.collection('attempts').getOne(id).catch(() => null);
  if (!a || a.user !== user.id) throw new HttpError(404, 'Test not found');
  return a;
}

export function deadline(a: RecordModel): number | null {
  if (!a.duration_sec) return null;
  return new Date(a.started_at).getTime() + a.duration_sec * 1000;
}


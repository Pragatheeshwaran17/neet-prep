import { C } from '@/lib/collections';
import 'server-only';
import PocketBase, { type RecordModel } from 'pocketbase';
import { NextResponse } from 'next/server';
import type { PublicQuestion, Subject } from './types';

export const PB_URL = (process.env.NEXT_PUBLIC_PB_URL || '').replace(/\/+$/, '');

let admin: PocketBase | null = null;
let adminExpires = 0;

/** PocketBase client authenticated as superuser. Server-side only. */
export async function adminPb(): Promise<PocketBase> {
  if (admin && admin.authStore.isValid && Date.now() < adminExpires) return admin;
  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;
  if (!email || !password) throw new HttpError(500, 'Server is missing PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD');
  const client = new PocketBase(PB_URL);
  client.autoCancellation(false);
  await client.collection('_superusers').authWithPassword(email, password);
  admin = client;
  adminExpires = Date.now() + 30 * 60 * 1000;
  return client;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Validates the student's token (sent in Authorization header) and returns their user record */
export async function requireUser(req: Request): Promise<RecordModel> {
  const token = req.headers.get('authorization');
  if (!token) throw new HttpError(401, 'Please log in');
  const client = new PocketBase(PB_URL);
  client.autoCancellation(false);
  client.authStore.save(token, null);
  try {
    const r = await client.collection(C.users).authRefresh();
    return r.record;
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }
}

export function handle(fn: (req: Request, ctx: any) => Promise<unknown>) {
  return async (req: Request, ctx: any) => {
    try {
      return NextResponse.json(await fn(req, ctx));
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : e?.status && e.status >= 400 ? e.status : 500;
      if (status >= 500) console.error(e);
      return NextResponse.json({ error: e?.message || 'Something went wrong' }, { status });
    }
  };
}

export const fileUrl = (rec: RecordModel, field: string) =>
  rec[field] ? `${PB_URL}/api/files/${rec.collectionId}/${rec.id}/${rec[field]}` : null;

export function toPublic(q: RecordModel): PublicQuestion {
  return {
    id: q.id,
    number: q.number,
    subject: q.subject as Subject,
    question: q.question || '',
    options: Array.isArray(q.options) ? q.options : [],
    display: q.display === 'image' ? 'image' : 'text',
    imageUrl: fileUrl(q, 'question_image'),
  };
}

/** Fetch questions by id, preserving the given order */
export async function questionsByIds(ids: string[]): Promise<RecordModel[]> {
  const pb = await adminPb();
  const out: RecordModel[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const filter = chunk.map((id) => `id="${id}"`).join(' || ');
    out.push(...(await pb.collection(C.questions).getFullList({ filter })));
  }
  const map = new Map(out.map((q) => [q.id, q]));
  return ids.map((id) => map.get(id)).filter(Boolean) as RecordModel[];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Like requireUser, but the user must have role = "admin" */
export async function requireAdmin(req: Request): Promise<RecordModel> {
  const user = await requireUser(req);
  if (user.role !== 'admin') throw new HttpError(403, 'Admins only');
  return user;
}

/** Full question incl. hidden fields, for the admin editor */
export function toAdmin(q: RecordModel) {
  return {
    ...toPublic(q),
    paper: q.paper as string,
    answer: (q.answer as number) || null,
    solution: (q.solution as string) || '',
    solutionImageUrl: fileUrl(q, 'solution_image'),
    note: (q.note as string) || '',
    status: (q.status as string) || 'draft',
    page: (q.page as number) || null,
  };
}

'use client';
import PocketBase from 'pocketbase';
import { C } from './collections';

export const PB_URL = (process.env.NEXT_PUBLIC_PB_URL || '').replace(/\/+$/, '');

let client: PocketBase | null = null;

/** Browser PocketBase client. Auth is kept in localStorage by the SDK. */
export function pb() {
  if (!client) {
    client = new PocketBase(PB_URL);
    client.autoCancellation(false);
    // drop a saved login that belongs to a different auth collection (e.g. after a rename)
    const rec = client.authStore.record;
    if (rec && rec.collectionName && rec.collectionName !== C.users) client.authStore.clear();
  }
  return client;
}

/** fetch() to our own API routes with the student's auth token attached */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb().authStore.token,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

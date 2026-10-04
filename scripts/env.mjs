// Shared helpers for the maintenance scripts: loads .env.local and logs in to PocketBase as superuser.
import { readFileSync, existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export const PB = (process.env.NEXT_PUBLIC_PB_URL || '').replace(/\/+$/, '');
export const PREFIX = process.env.NEXT_PUBLIC_PB_PREFIX ?? '';
export const C = {
  users: `${PREFIX}users`,
  papers: `${PREFIX}papers`,
  questions: `${PREFIX}questions`,
  attempts: `${PREFIX}attempts`,
};

let TOKEN = '';

export async function api(method, url, body) {
  const res = await fetch(PB + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN && { Authorization: TOKEN }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(data)}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

export async function login() {
  const { PB_ADMIN_EMAIL: identity, PB_ADMIN_PASSWORD: password } = process.env;
  if (!PB || !identity || !password) {
    console.error('Fill NEXT_PUBLIC_PB_URL, PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in .env.local first.');
    process.exit(1);
  }
  TOKEN = (await api('POST', '/api/collections/_superusers/auth-with-password', { identity, password })).token;
  console.log(`✓ Logged in to ${PB}`);
}

export async function getCollection(name) {
  try { return await api('GET', `/api/collections/${name}`); }
  catch (e) { if (e.status === 404) return null; throw e; }
}

/** Rules for the app's own users collection: anyone can sign up as a student, nobody can make themselves admin */
export const USER_RULES = {
  listRule: 'id = @request.auth.id',
  viewRule: 'id = @request.auth.id',
  createRule: '@request.body.role = "" || @request.body.role = "student"',
  updateRule: 'id = @request.auth.id && @request.body.role:isset = false',
  deleteRule: null,
};

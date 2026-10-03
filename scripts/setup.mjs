// One-time PocketBase setup for the app. Safe to re-run.
// Reads NEXT_PUBLIC_PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD from .env.local
import { readFileSync, existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const PB = (process.env.NEXT_PUBLIC_PB_URL || '').replace(/\/+$/, '');
const { PB_ADMIN_EMAIL: email, PB_ADMIN_PASSWORD: password } = process.env;
if (!PB || !email || !password) {
  console.error('Fill NEXT_PUBLIC_PB_URL, PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in .env.local first.');
  process.exit(1);
}

let TOKEN = '';
async function api(method, url, body) {
  const res = await fetch(PB + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN && { Authorization: TOKEN }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

TOKEN = (await api('POST', '/api/collections/_superusers/auth-with-password', { identity: email, password })).token;
console.log(`✓ Logged in to ${PB}`);

// users: students can sign up but can never make themselves admin
const users = await api('GET', '/api/collections/users');
await api('PATCH', `/api/collections/${users.id}`, {
  createRule: '@request.body.role = "" || @request.body.role = "student"',
  updateRule: 'id = @request.auth.id && @request.body.role:isset = false',
});
console.log('✓ users: sign-up allowed, role locked');

// attempts: students can only read their own; all writes go through the app server (anti-cheat)
const attempts = await api('GET', '/api/collections/attempts');
const fields = attempts.fields;
const add = (f) => { if (!fields.some((x) => x.name === f.name)) fields.push(f); };
add({ name: 'duration_sec', type: 'number', onlyInt: true });
add({ name: 'marked', type: 'json', maxSize: 200000 });
add({ name: 'total', type: 'number', onlyInt: true });
await api('PATCH', `/api/collections/${attempts.id}`, {
  fields,
  listRule: 'user = @request.auth.id',
  viewRule: 'user = @request.auth.id',
  createRule: null,
  updateRule: null,
  deleteRule: null,
});
console.log('✓ attempts: read-own only, writes via server');
console.log('\nAll set. Run: npm run dev');

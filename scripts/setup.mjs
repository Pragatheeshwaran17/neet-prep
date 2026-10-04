// One-time PocketBase setup for the app (rules + extra fields). Safe to re-run.
import { api, C, getCollection, login, USER_RULES } from './env.mjs';

await login();

const users = await getCollection(C.users);
if (!users) { console.error(`Collection ${C.users} not found. Check NEXT_PUBLIC_PB_URL`); process.exit(1); }
await api('PATCH', `/api/collections/${users.id}`, { createRule: USER_RULES.createRule, updateRule: USER_RULES.updateRule });
console.log(`✓ ${C.users}: sign-up allowed, role locked`);

// attempts: students can only read their own; all writes go through the app server (anti-cheat)
const attempts = await getCollection(C.attempts);
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
console.log(`✓ ${C.attempts}: read-own only, writes via server`);
console.log('\nAll set. Run: npm run dev');

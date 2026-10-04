// Promote a user to admin:  npm run make-admin -- you@example.com   (add --remove to demote)
import { api, C, login } from './env.mjs';

const email = process.argv[2];
const demote = process.argv.includes('--remove');
if (!email || email.startsWith('--')) { console.error('Usage: npm run make-admin -- someone@example.com [--remove]'); process.exit(1); }

await login();
const list = await api('GET', `/api/collections/${C.users}/records?filter=${encodeURIComponent(`email="${email}"`)}`);
const user = list.items?.[0];
if (!user) { console.error(`No account with email ${email} in ${C.users}. Sign up in the app first.`); process.exit(1); }
await api('PATCH', `/api/collections/${C.users}/records/${user.id}`, { role: demote ? 'student' : 'admin' });
console.log(demote ? `✓ ${email} is now a student` : `✓ ${email} is now an admin. Log out and back in, then open /admin`);

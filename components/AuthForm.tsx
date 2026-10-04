'use client';
import { C } from '@/lib/collections';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pb';

function niceError(e: any): string {
  const data = e?.response?.data || {};
  const first = Object.entries(data)[0] as [string, { message?: string }] | undefined;
  if (first) return `${first[0][0].toUpperCase() + first[0].slice(1)}: ${first[1]?.message}`;
  if (e?.status === 400) return 'Wrong email or password.';
  if (e?.status === 0) return 'Cannot reach the server. Check your internet connection.';
  return e?.message || 'Something went wrong';
}

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const users = pb().collection(C.users);
      if (mode === 'signup') {
        await users.create({ name: form.name, email: form.email, password: form.password, passwordConfirm: form.password, role: 'student' });
      }
      await users.authWithPassword(form.email, form.password);
      router.replace('/dashboard');
    } catch (err) {
      setError(niceError(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="mt-1 text-sm text-slate-500">{mode === 'login' ? 'Log in to continue practising.' : 'Free. Takes 10 seconds.'}</p>
      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        {mode === 'signup' && (
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="input" required value={form.name} onChange={set('name')} autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" required value={form.email} onChange={set('email')} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" required minLength={8} value={form.password} onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          {mode === 'signup' && <p className="mt-1 text-xs text-slate-500">At least 8 characters</p>}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {mode === 'login' ? <>New here? <Link className="font-semibold text-brand-600" href="/signup">Create an account</Link></>
          : <>Already have an account? <Link className="font-semibold text-brand-600" href="/login">Log in</Link></>}
      </p>
    </div>
  );
}

'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pb';

export default function Home() {
  const router = useRouter();
  useEffect(() => { if (pb().authStore.isValid) router.replace('/dashboard'); }, [router]);

  return (
    <div className="mx-auto max-w-3xl py-10 text-center sm:py-20">
      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">NEET · Physics · Chemistry · Biology</span>
      <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">Practise NEET questions, one subject at a time.</h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
        Real previous-year questions, timed tests, NEET marking (+4 / −1), and a full solution for every question when you finish.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/signup" className="btn-primary px-6 py-3 text-base">Create free account</Link>
        <Link href="/login" className="btn-ghost px-6 py-3 text-base">Log in</Link>
      </div>
      <div className="mt-14 grid gap-4 text-left sm:grid-cols-3">
        {[
          ['Subject-wise', 'Pick Physics, Chemistry or Biology and choose how many questions.'],
          ['Exam-like', 'Timer, question palette, mark-for-review — just like the real NTA screen.'],
          ['Learn from mistakes', 'See the right answer and worked solution for every question.'],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <div className="font-semibold">{t}</div>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

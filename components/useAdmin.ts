'use client';
import { C } from '@/lib/collections';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pb';
import { useAuth } from './useAuth';

/** Refreshes the user's record (so a newly promoted admin works without re-login) and requires role=admin */
export function useAdmin() {
  const { user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking');
  useEffect(() => {
    if (!user) return;
    pb().collection(C.users).authRefresh()
      .then((r) => {
        if (r.record.role === 'admin') setState('ok');
        else { setState('denied'); router.replace('/dashboard'); }
      })
      .catch(() => { pb().authStore.clear(); router.replace('/login'); });
  }, [user, router]);
  return state;
}

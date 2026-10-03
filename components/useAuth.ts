'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RecordModel } from 'pocketbase';
import { pb } from '@/lib/pb';

/** Returns the logged-in user; redirects to /login when required and not logged in */
export function useAuth(required = true) {
  const router = useRouter();
  const [user, setUser] = useState<RecordModel | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const store = pb().authStore;
    const sync = () => setUser(store.isValid ? (store.record as RecordModel) : null);
    sync();
    setReady(true);
    if (required && !store.isValid) router.replace('/login');
    return store.onChange(sync);
  }, [required, router]);

  return { user, ready };
}

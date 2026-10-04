'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { pb } from '@/lib/pb';
import { useAuth } from './useAuth';

export default function Header() {
  const { user } = useAuth(false);
  const router = useRouter();
  const path = usePathname();
  if (path?.startsWith('/test/')) return null; // distraction-free exam screen

  const link = (href: string, label: string) => (
    <Link href={href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${(href === '/admin' ? path?.startsWith('/admin') : path === href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900'}`}>
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm text-white">N</span>
          <span>NEET Prep</span>
        </Link>
        {user && (
          <nav className="ml-2 hidden gap-1 sm:flex">
            {link('/dashboard', 'Dashboard')}
            {link('/history', 'My tests')}
            {user.role === 'admin' && link('/admin', 'Admin')}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-slate-500 md:inline">{user.name || user.email}</span>
              <button
                className="btn-ghost !py-1.5"
                onClick={() => { pb().authStore.clear(); router.push('/login'); }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost !py-1.5">Log in</Link>
              <Link href="/signup" className="btn-primary !py-1.5">Sign up</Link>
            </>
          )}
        </div>
      </div>
      {user && (
        <nav className="flex gap-1 border-t border-slate-100 px-4 py-1.5 sm:hidden">
          {link('/dashboard', 'Dashboard')}
          {link('/history', 'My tests')}
          {user.role === 'admin' && link('/admin', 'Admin')}
        </nav>
      )}
    </header>
  );
}

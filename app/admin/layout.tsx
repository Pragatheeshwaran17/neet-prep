'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/components/useAdmin';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const state = useAdmin();
  const path = usePathname();
  if (state !== 'ok') return <div className="py-20 text-center text-slate-500">{state === 'denied' ? 'Admins only.' : 'Checking access…'}</div>;
  const tab = (href: string, label: string) => {
    const active = href === '/admin' ? path === '/admin' || path?.startsWith('/admin/papers') : path?.startsWith(href);
    return <Link href={href} className={`whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-semibold ${active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</Link>;
  };
  return (
    <div>
      <div className="mb-6 flex gap-6 overflow-x-auto border-b border-slate-200">
        {tab('/admin', 'Question bank')}
        {tab('/admin/upload', 'Upload PDF')}
        {tab('/admin/students', 'Students')}
      </div>
      {children}
    </div>
  );
}

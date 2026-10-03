import type { Metadata, Viewport } from 'next';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'NEET Prep — Practice Tests',
  description: 'Subject-wise NEET practice tests with instant scoring and solutions',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2453e6' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { AdminApp } from '@/components/store/admin/admin-app';
import { isValidSection } from '@/components/store/admin/sections';
import { spString } from '@/lib/nav';

export const metadata: Metadata = {
  title: 'অ্যাডমিন প্যানেল — THE SHOP BD',
  description: 'THE SHOP BD অ্যাডমিন প্যানেল — পণ্য, অর্ডার, কাস্টমার, মার্কেটিং ও সাইট ম্যানেজমেন্ট।',
  robots: { index: false, follow: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const s = spString(sp.section);
  const initialSection = isValidSection(s) ? s : undefined;
  return <AdminApp initialSection={initialSection} />;
}

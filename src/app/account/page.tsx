import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';
import { spString } from '@/lib/nav';
import type { AccountTab } from '@/lib/types';

export const metadata: Metadata = {
  title: 'আমার অ্যাকাউন্ট — THE SHOP BD',
  description: 'আপনার অর্ডার, প্রোফাইল, ঠিকানা, নোটিফিকেশন, টিকেট, রিভিউ ও নিরাপত্তা সেটিংস — সব এক জায়গায়।',
  alternates: { canonical: '/account' },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AccountPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <AppShell view={{ name: 'account', tab: spString(sp.tab) as AccountTab | undefined }} />;
}

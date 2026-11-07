import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';
import { spString } from '@/lib/nav';

export const metadata: Metadata = {
  title: 'সার্চ করুন — THE SHOP BD',
  description:
    'THE SHOP BD-এ পণ্য সার্চ করুন — রিয়েল-টাইম ফলাফলসহ পাঞ্জাবি, ঘড়ি, জুতা, ইলেকট্রনিকস, বিউটি সহ সব ব্র্যান্ডের অরিজিনাল পণ্য খুঁজে নিন।',
  alternates: { canonical: '/search' },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <AppShell view={{ name: 'search', q: spString(sp.q) }} />;
}

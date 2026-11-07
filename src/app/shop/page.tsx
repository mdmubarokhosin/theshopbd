import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';
import { spString, spBool } from '@/lib/nav';

export const metadata: Metadata = {
  title: 'সকল পণ্য — THE SHOP BD',
  description:
    'The Shop BD-এর সব পণ্য এক পেজে — ক্যাটাগরি, ব্র্যান্ড, দাম ও রেটিং অনুযায়ী ফিল্টার করে অরিজিনাল পণ্য কিনুন।',
  alternates: { canonical: '/shop' },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <AppShell
      view={{
        name: 'shop',
        search: spString(sp.q),
        brand: spString(sp.brand),
        offers: spBool(sp.offers),
      }}
    />
  );
}

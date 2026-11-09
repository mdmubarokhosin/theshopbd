import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';
import { spString } from '@/lib/nav';

export const metadata: Metadata = {
  title: 'অর্ডার ট্র্যাক করুন — THE SHOP BD',
  description: 'অর্ডার নম্বর দিয়ে আপনার অর্ডারের বর্তমান অবস্থা ও ডেলিভারি টাইমলাইন দেখুন।',
  alternates: { canonical: '/track-order' },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function TrackOrderPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <AppShell view={{ name: 'track-order', orderNumber: spString(sp.id) }} />;
}

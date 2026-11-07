import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';
import { spString } from '@/lib/nav';

export const metadata: Metadata = {
  title: 'অর্ডার সফল হয়েছে — THE SHOP BD',
  robots: { index: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function OrderSuccessPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <AppShell view={{ name: 'order-success', orderNumber: spString(sp.order) || '' }} />;
}

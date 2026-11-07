import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'শপিং কার্ট — THE SHOP BD',
  description: 'আপনার কার্টের পণ্যগুলো দেখুন, পরিমাণ বদলান ও চেকআউটে যান।',
  alternates: { canonical: '/cart' },
};

export default function CartPage() {
  return <AppShell view={{ name: 'cart' }} />;
}

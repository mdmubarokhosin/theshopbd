import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'পণ্য তুলনা করুন — THE SHOP BD',
  description: 'একাধিক পণ্যের দাম, ফিচার ও রেটিং পাশাপাশি তুলনা করে সেরা পছন্দটি বেছে নিন।',
  alternates: { canonical: '/compare' },
};

export default function ComparePage() {
  return <AppShell view={{ name: 'compare' }} />;
}

import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'চেকআউট — THE SHOP BD',
  description: 'ডেলিভারি ঠিকানা দিন, পেমেন্ট মেথড বেছে নিন ও অর্ডার সম্পন্ন করুন — ক্যাশ অন ডেলিভারি সুবিধাসহ।',
  alternates: { canonical: '/checkout' },
};

export default function CheckoutPage() {
  return <AppShell view={{ name: 'checkout' }} />;
}

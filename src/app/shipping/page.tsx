import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'শিপিং ও ডেলিভারি তথ্য — THE SHOP BD',
  description: 'ঢাকার ভেতরে ও বাইরে ডেলিভারি চার্জ, সময়সীমা ও কুরিয়ার তথ্য।',
  alternates: { canonical: '/shipping' },
};

export default function ShippingPage() {
  return <AppShell view={{ name: 'info', page: 'shipping' }} />;
}

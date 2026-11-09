import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'সাধারণ জিজ্ঞাসা (FAQ) — THE SHOP BD',
  description: 'অর্ডার, ডেলিভারি, পেমেন্ট, রিটার্ন নিয়ে সচরাচর জিজ্ঞাসিত প্রশ্নের উত্তর।',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  return <AppShell view={{ name: 'info', page: 'faq' }} />;
}

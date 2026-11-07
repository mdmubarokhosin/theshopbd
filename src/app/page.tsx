import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'THE SHOP BD — মাল্টিব্র্যান্ড অনলাইন শপিং',
  description:
    'THE SHOP BD হোমপেজ — ফ্ল্যাশ সেল, নতুন পণ্য, বেস্ট সেলার ও বিশেষ অফার। ইলেকট্রনিকস, ফ্যাশন, ঘর ও লিভিং, বিউটি সহ ২১+ ব্র্যান্ডের অরিজিনাল পণ্য।',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <AppShell view={{ name: 'home' }} />;
}

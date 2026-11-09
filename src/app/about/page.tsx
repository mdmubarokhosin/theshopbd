import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'আমাদের সম্পর্কে — THE SHOP BD',
  description: 'THE SHOP BD সম্পর্কে জানুন — বাংলাদেশের বিশ্বস্ত মাল্টিব্র্যান্ড অনলাইন শপ, আমাদের লক্ষ্য ও প্রতিশ্রুতি।',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return <AppShell view={{ name: 'info', page: 'about' }} />;
}

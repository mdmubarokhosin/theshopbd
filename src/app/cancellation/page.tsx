import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'বাতিলকরণ ও রিটার্ন নীতিমালা — THE SHOP BD',
  description: 'অর্ডার বাতিল, পণ্য ফেরত ও রিফান্ড সংক্রান্ত নীতিমালা।',
  alternates: { canonical: '/cancellation' },
};

export default function CancellationPage() {
  return <AppShell view={{ name: 'info', page: 'cancellation' }} />;
}

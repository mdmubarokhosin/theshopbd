import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'প্রাইভেসি পলিসি — THE SHOP BD',
  description: 'আপনার ব্যক্তিগত তথ্য কীভাবে সংগ্রহ ও সুরক্ষা করা হয় — The Shop BD-এর প্রাইভেসি পলিসি।',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <AppShell view={{ name: 'info', page: 'privacy' }} />;
}

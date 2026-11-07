import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'কাস্টমার স্টোরিজ — THE SHOP BD',
  description: 'আমাদের কাস্টমারদের অভিজ্ঞতা ও মতামত — THE SHOP BD।',
  alternates: { canonical: '/stories' },
};

export default function StoriesPage() {
  return <AppShell view={{ name: 'info', page: 'stories' }} />;
}

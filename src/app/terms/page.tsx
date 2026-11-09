import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'শর্তাবলী — THE SHOP BD',
  description: 'THE SHOP BD ব্যবহারের সাধারণ শর্তাবলী ও নীতিমালা।',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <AppShell view={{ name: 'info', page: 'terms' }} />;
}

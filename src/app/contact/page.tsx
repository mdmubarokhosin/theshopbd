import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'যোগাযোগ করুন — THE SHOP BD',
  description: 'ফোন, ইমেইল, ঠিকানা ও যোগাযোগ ফর্ম — THE SHOP BD সাপোর্ট টিমের সাথে কথা বলুন।',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return <AppShell view={{ name: 'info', page: 'contact' }} />;
}

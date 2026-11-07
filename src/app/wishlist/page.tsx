import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

export const metadata: Metadata = {
  title: 'উইশলিস্ট — THE SHOP BD',
  description: 'আপনার পছন্দের পণ্যগুলো সংরক্ষিত আছে এখানে — পরে কিনতে সহজে খুঁজে পান।',
  alternates: { canonical: '/wishlist' },
};

export default function WishlistPage() {
  return <AppShell view={{ name: 'wishlist' }} />;
}

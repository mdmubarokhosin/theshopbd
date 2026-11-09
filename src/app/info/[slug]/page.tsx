import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';
import type { InfoPage } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pretty = decodeURIComponent(slug).split('-').join(' ');
  return {
    title: `${pretty.charAt(0).toUpperCase() + pretty.slice(1)} — THE SHOP BD`,
    description: `${pretty} — THE SHOP BD ইনফরমেশন পেজ।`,
  };
}

export default async function InfoPageView({ params }: Props) {
  const { slug } = await params;
  return <AppShell view={{ name: 'info', page: decodeURIComponent(slug) as InfoPage }} />;
}

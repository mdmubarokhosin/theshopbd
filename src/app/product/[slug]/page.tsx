import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: 'পণ্য ডিটেইল — THE SHOP BD',
    description: 'পণ্যের সম্পূর্ণ বিবরণ, দাম, ভ্যারিয়েন্ট ও রিভিউ — THE SHOP BD, বাংলাদেশের মাল্টিব্র্যান্ড অনলাইন শপ।',
    alternates: { canonical: `/product/${slug}` },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  return <AppShell view={{ name: 'product', slug }} />;
}

import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';
import { spString, spBool } from '@/lib/nav';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pretty = decodeURIComponent(slug)
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
  return {
    title: `${pretty} — THE SHOP BD`,
    description: `The Shop BD-এর ${pretty} ক্যাটাগরির সব পণ্য — অরিজিনাল ব্র্যান্ডেড পণ্য, সেরা দামে সারাদেশে হোম ডেলিভারি।`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  return (
    <AppShell
      view={{
        name: 'shop',
        category: slug,
        search: spString(sp.q),
        brand: spString(sp.brand),
        offers: spBool(sp.offers),
      }}
    />
  );
}

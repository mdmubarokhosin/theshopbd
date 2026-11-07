/**
 * পণ্য ডিটেইল পেজ — ডাইনামিক OG মেটাডেটা সহ
 * ---------------------------------------------------------------------------
 * পণ্য শেয়ার করলে (Facebook / WhatsApp / Messenger) পণ্যের ছবি, নাম ও দাম
 * সহ প্রিভিউ দেখাবে — সার্ভার-সাইডে RTDB REST থেকে পণ্য পড়ে মেটা বানানো হয়।
 * RTDB না পাওয়া গেলে স্ট্যাটিক ফলব্যাক মেটাডেটা।
 */
import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';
import { readShop } from '@/lib/server/rtdb';

type Props = { params: Promise<{ slug: string }> };

type MetaProduct = {
  name: string;
  nameBn?: string | null;
  slug: string;
  price: number;
  comparePrice?: number | null;
  shortDescription?: string | null;
  description?: string;
  images: string;
};

/** সাইটের অ্যাবসোলিউট বেস URL (OG ছবি অ্যাবসোলিউট হতে হবে) */
function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  return 'https://store.mdmubarok.com';
}

function productImages(images: string): string[] {
  try {
    const arr = JSON.parse(images);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [images];
  } catch {
    return images ? [images] : [];
  }
}

async function findProduct(slug: string): Promise<MetaProduct | null> {
  const raw = await readShop<unknown>('products');
  if (!raw) return null;
  const list: MetaProduct[] = Array.isArray(raw)
    ? (raw as MetaProduct[])
    : Object.values(raw as Record<string, MetaProduct>);
  return list.find((p) => p && p.slug === slug && (p as unknown as { active?: boolean }).active !== false) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const base = siteUrl();

  const fallback: Metadata = {
    title: 'পণ্য ডিটেইল — THE SHOP BD',
    description:
      'পণ্যের সম্পূর্ণ বিবরণ, দাম, ভ্যারিয়েন্ট ও রিভিউ — THE SHOP BD, বাংলাদেশের মাল্টিব্র্যান্ড অনলাইন শপ।',
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      title: 'THE SHOP BD — মাল্টিব্র্যান্ড অনলাইন শপিং',
      description: '২১+ বিখ্যাত ব্র্যান্ডের অরিজিনাল পণ্য এক ঠিকানায়। সারাদেশে দ্রুত হোম ডেলিভারি।',
      siteName: 'THE SHOP BD',
      type: 'website',
      locale: 'bn_BD',
      url: `${base}/product/${slug}`,
    },
    twitter: { card: 'summary_large_image' },
  };

  try {
    const p = await findProduct(slug);
    if (!p) return fallback;
    const title = p.nameBn || p.name;
    const priceLine = `মূল্য: ৳${p.price.toLocaleString('bn-BD')}`;
    const description =
      p.shortDescription?.trim() ||
      (p.description ? p.description.slice(0, 160) : 'অরিজিনাল পণ্য — সারাদেশে দ্রুত হোম ডেলিভারি।');
    const images = productImages(p.images)
      .slice(0, 4)
      .map((src) => (src.startsWith('http') ? src : src.startsWith('/') ? `${base}${src}` : src));

    return {
      title: `${title} — THE SHOP BD`,
      description: `${priceLine} — ${description}`,
      alternates: { canonical: `/product/${slug}` },
      openGraph: {
        title: `${title} — মাত্র ৳${p.price.toLocaleString('bn-BD')}`,
        description,
        images: images.length ? images : undefined,
        siteName: 'THE SHOP BD',
        type: 'website',
        locale: 'bn_BD',
        url: `${base}/product/${slug}`,
      },
      twitter: {
        card: images.length ? 'summary_large_image' : 'summary',
        title: `${title} — THE SHOP BD`,
        description,
        images: images.length ? images.slice(0, 1) : undefined,
      },
    };
  } catch {
    return fallback;
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  return <AppShell view={{ name: 'product', slug }} />;
}

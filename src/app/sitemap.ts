import type { MetadataRoute } from 'next';
import { categoryTree } from '@/lib/db/services';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/** স্ট্যাটিক পেজ রাউট (info পেজসহ) */
const STATIC_ROUTES = [
  '/',
  '/shop',
  '/cart',
  '/wishlist',
  '/compare',
  '/login',
  '/track-order',
  '/about',
  '/contact',
  '/faq',
  '/shipping',
  '/cancellation',
  '/terms',
  '/privacy',
  '/stories',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.6,
  }));

  // ক্যাটাগরি পেজ (localStorage ডেটা লেয়ার — সার্ভারে সিড ডেটা থেকে আসে)
  let categoryEntries: MetadataRoute.Sitemap = [];
  try {
    const cats = categoryTree().filter((c) => c.active !== false);
    categoryEntries = cats.map((c) => ({
      url: `${BASE_URL}/category/${c.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));
  } catch {
    // সিড ডেটা লোড ব্যর্থ হলে শুধু স্ট্যাটিক রাউট
  }

  return [...staticEntries, ...categoryEntries];
}

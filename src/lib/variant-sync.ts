/**
 * ভ্যারিয়েন্ট সিঙ্ক হেল্পার — এখন সবকিছু প্রোডাক্ট অবজেক্টের ভেতরেই থাকে
 * (localStorage ডেটা লেয়ার), তাই এটি শুধু নরমালাইজ করে।
 */
import type { ProductVariant } from '@/lib/types';

export type VariantInput = {
  key?: string;
  color?: string | null;
  colorHex?: string | null;
  size?: string | null;
  price: number;
  stock: number;
  image?: string | null;
  active?: boolean;
};

/** ইনপুট ভ্যারিয়েন্ট লিস্ট → নরমালাইজড ProductVariant[] (ডুপ্লিকেট কী বাদ) */
export function normalizeVariants(variants?: VariantInput[]): ProductVariant[] {
  const incoming = Array.isArray(variants) ? variants : [];
  const rows = incoming
    .filter((v) => v && typeof v.price === 'number' && !Number.isNaN(v.price))
    .map((v) => ({
      key: [v.color || '', v.size || ''].join('|'),
      color: v.color ?? null,
      colorHex: v.colorHex ?? null,
      size: v.size ?? null,
      price: v.price,
      stock: Number(v.stock) || 0,
      image: v.image ?? null,
    }));
  // ডুপ্লিকেট কী: শেষটা প্রাধান্য পায়
  const byKey = new Map<string, ProductVariant>();
  for (const row of rows) byKey.set(row.key, row);
  return Array.from(byKey.values());
}

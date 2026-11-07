/**
 * THE SHOP BD — URL রাউটিং ম্যাপার
 * ─────────────────────────────────────────────────────────────
 * প্রতিটি পেজের নিজস্ব URL আছে (App Router):
 *   /                  → হোম
 *   /shop              → সকল পণ্য (?q= সার্চ, ?brand=, ?offers=1)
 *   /search            → সার্চ পেজ (?q= রিয়েল-টাইম কুয়েরি)
 *   /category/<slug>   → ক্যাটাগরি পেজ (Daraz-স্টাইল ক্যানোনিকাল লিংক)
 *   /product/<slug>    → পণ্য ডিটেইল
 *   /cart /checkout /wishlist /compare
 *   /order-success?order=<no>
 *   /track-order?id=<no>
 *   /login (?mode=register)
 *   /account (?tab=orders ইত্যাদি)
 *   /about /contact /faq /shipping /cancellation /terms /privacy /stories
 *   /info/<slug>       → CMS কাস্টম পেজ
 *   /admin (?section=orders ইত্যাদি)
 *
 * store.navigate(View) → viewToUrl() → Next.js router.push()
 * — তাই সব পুরনো navigate() কল এখন রিয়েল URL তৈরি করে।
 */

import type { View, InfoPage } from '@/lib/types';

/** Next.js router-এর সংক্ষিপ্ত ইন্টারফেস (next/navigation useRouter) */
type NavRouter = { push: (url: string) => void; back: () => void; replace?: (url: string) => void };

let navRouter: NavRouter | null = null;

/** AppShell/AdminShell mount-এ Next router নিবন্ধন করে */
export function setNavRouter(r: NavRouter | null): void {
  navRouter = r;
}

/** view → URL push (router না থাকলে ফুল রিলোড ফলব্যাক) */
export function navPush(url: string): void {
  if (navRouter) navRouter.push(url);
  else if (typeof window !== 'undefined') window.location.assign(url);
}

export function navReplace(url: string): void {
  if (navRouter?.replace) navRouter.replace(url);
  else if (typeof window !== 'undefined') window.history.replaceState(null, '', url);
}

export function navBack(): void {
  if (navRouter) navRouter.back();
  else if (typeof window !== 'undefined') window.history.back();
}

/** যেসব info স্লাগের নিজস্ব রুট-লেভেল URL আছে */
export const WELLKNOWN_INFO_SLUGS = [
  'about',
  'contact',
  'faq',
  'shipping',
  'cancellation',
  'terms',
  'privacy',
  'stories',
] as const;

/** info স্লাগ → URL (about → /about, কাস্টম → /info/<slug>) */
export function infoPageUrl(page: InfoPage): string {
  const slug = String(page);
  return (WELLKNOWN_INFO_SLUGS as readonly string[]).includes(slug) ? `/${slug}` : `/info/${encodeURIComponent(slug)}`;
}

/** URL-এর জন্য slug/safe string */
function enc(v: string): string {
  return encodeURIComponent(v);
}

/** query string তৈরি (খালি মান বাদ) */
function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** View অবজেক্ট → শেয়ারযোগ্য URL */
export function viewToUrl(view: View): string {
  switch (view.name) {
    case 'home':
      return '/';
    case 'shop': {
      const query = qs({ q: view.search, brand: view.brand, offers: view.offers ? '1' : undefined });
      return view.category ? `/category/${enc(view.category)}${query}` : `/shop${query}`;
    }
    case 'search':
      return `/search${qs({ q: view.q })}`;
    case 'product':
      return `/product/${enc(view.slug)}`;
    case 'cart':
      return '/cart';
    case 'checkout':
      return '/checkout';
    case 'order-success':
      return `/order-success${qs({ order: view.orderNumber })}`;
    case 'track-order':
      return `/track-order${qs({ id: view.orderNumber })}`;
    case 'wishlist':
      return '/wishlist';
    case 'compare':
      return '/compare';
    case 'info':
      return infoPageUrl(view.page);
    case 'auth':
      return view.mode === 'register' ? '/login?mode=register' : '/login';
    case 'account':
      return `/account${qs({ tab: view.tab })}`;
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

/** সার্চপ্যারাম থেকে নিরাপদ স্ট্রিং */
export function spString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0] || undefined;
  return v || undefined;
}

/** সার্চপ্যারাম থেকে বুলিয়ান ("1" / "true") */
export function spBool(v: string | string[] | undefined): boolean {
  const s = spString(v);
  return s === '1' || s === 'true';
}

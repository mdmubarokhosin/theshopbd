'use client';

import { create } from 'zustand';
import type { View } from '@/lib/types';
import { db } from '@/lib/db/core';
import { DEFAULT_SITE_SETTINGS } from '@/lib/db/seed-data';
import { notifyAuthChanged } from '@/lib/db/hooks';
import { navPush, navBack, viewToUrl } from '@/lib/nav';

type StoreState = {
  view: View;
  wishlist: string[];
  compare: string[];
  cartCount: number;
  mobileMenuOpen: boolean;
  searchQuery: string;
  /** ০-এর বেশি হলে শপ পেজের সার্চবার অটো-ফোকাস করবে (মোবাইল সার্চ আইকন → সার্চ পেজ) */
  searchFocusTick: number;
  siteSettings: Record<string, string>;
  navigate: (view: View) => void;
  goBack: () => void;
  setView: (view: View) => void;
  setWishlist: (ids: string[]) => void;
  toggleWishlist: (productId: string) => void;
  setCompare: (ids: string[]) => void;
  setCartCount: (n: number) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  bumpSearchFocus: () => void;
  clearSearchFocus: () => void;
  setSiteSettings: (s: Record<string, string>) => void;
};

const WISHLIST_KEY = 'tsb_wishlist';

function getInitial<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

/** Settings map বানায়: ডিফল্ট + DB-তে ওভাররাইড */
export function settingsAsMap(): Record<string, string> {
  const s = db.get().settings;
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(DEFAULT_SITE_SETTINGS)) map[k] = String((s as Record<string, string>)[k] ?? v);
  return map;
}

export const useStore = create<StoreState>((set, get) => ({
  view: { name: 'home' },
  wishlist: [],
  compare: [],
  cartCount: 0,
  mobileMenuOpen: false,
  searchQuery: '',
  searchFocusTick: 0,
  siteSettings: { ...DEFAULT_SITE_SETTINGS },

  /** URL-ভিত্তিক নেভিগেশন — View → রিয়েল URL → router.push (ব্রাউজার ব্যাক/ফরোয়ার্ড কাজ করে) */
  navigate: (view) => {
    set({ mobileMenuOpen: false });
    navPush(viewToUrl(view));
  },

  /** ব্রাউজার হিস্ট্রি ব্যাক */
  goBack: () => {
    navBack();
  },

  /** AppShell — URL/প্রপ থেকে বর্তমান view সিঙ্ক (অ্যাকটিভ নেভ হাইলাইটের জন্য) */
  setView: (view) => set({ view }),

  setWishlist: (ids) => {
    set({ wishlist: ids });
    if (typeof window !== 'undefined') localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  },

  toggleWishlist: (productId) => {
    const { wishlist } = get();
    const next = wishlist.includes(productId)
      ? wishlist.filter((id) => id !== productId)
      : [...wishlist, productId];
    get().setWishlist(next);
  },

  setCompare: (ids) => set({ compare: ids }),

  setCartCount: (n) => set({ cartCount: n }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  bumpSearchFocus: () => set((s) => ({ searchFocusTick: s.searchFocusTick + 1 })),
  clearSearchFocus: () => set({ searchFocusTick: 0 }),
  setSiteSettings: (s) => set({ siteSettings: s }),
}));

/** localStorage থেকে ইউজার-স্টেট হাইড্রেট (ক্লায়েন্ট mount-এ একবার) */
export function initClientState() {
  if (typeof window === 'undefined') return;
  // উইশলিস্ট
  const wl = getInitial<string[]>('tsb_wishlist', []);
  if (wl.length) useStore.getState().setWishlist(wl);

  // সেটিংস (DB-ভিত্তিক)
  useStore.getState().setSiteSettings(settingsAsMap());

  // DB পরিবর্তনে সেটিংস সিঙ্ক
  db.subscribe(() => {
    useStore.getState().setSiteSettings(settingsAsMap());
  });

  notifyAuthChanged();
}

/** পুরোনো নাম সংরক্ষণ (কম্পোনেন্ট কম্প্যাটিবিলিটি) */
export const loadSiteSettings = initClientState;
export function initWishlist() {
  const ids = getInitial<string[]>('tsb_wishlist', []);
  if (ids.length) useStore.getState().setWishlist(ids);
}

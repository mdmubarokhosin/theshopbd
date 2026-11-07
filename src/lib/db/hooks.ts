'use client';

/**
 * THE SHOP BD — React বাইন্ডিং হুক
 * ---------------------------------------------------------------------------
 * সব হুক useSyncExternalStore ভিত্তিক — hydration-safe (SSR-এ সিড ডেটা,
 * ক্লায়েন্টে বাস্তব localStorage ডেটা), কোনো setState-in-effect নেই।
 */
import { useCallback, useSyncExternalStore } from 'react';
import { db } from './core';
import { buildSeedData } from './seed-data';
import { getCart, type HydratedCartItem } from './services';
import { getCurrentUser } from './auth';
import type { DBData, DBCollection, SiteSettings, User } from './types';

// ── SSR সিড সিঙ্গলটন (স্থিতিশীল রেফারেন্স) ──
let SEED: DBData | null = null;
function seedDb(): DBData {
  if (!SEED) SEED = buildSeedData();
  return SEED;
}

const dbSubscribe = (cb: () => void) => db.subscribe(cb);

/** একটি কালেকশন সাবস্ক্রাইব করুন (যেকোনো মিউটেশনে অটো রি-রেন্ডার) */
export function useCollection<K extends DBCollection>(name: K): DBData[K] {
  const getSnapshot = useCallback(() => db.collection(name), [name]);
  const getServer = useCallback(() => seedDb()[name], [name]);
  return useSyncExternalStore(dbSubscribe, getSnapshot, getServer);
}

/** সাইট সেটিংস (অ্যাডমিন-নিয়ন্ত্রিত সব ভ্যালু) */
export function useSettings(): SiteSettings {
  const getSnapshot = useCallback(() => db.get().settings, []);
  const getServer = useCallback(() => seedDb().settings, []);
  return useSyncExternalStore(dbSubscribe, getSnapshot, getServer);
}

/** পুরো DB অবজেক্ট (উন্নত ব্যবহারের জন্য) */
export function useDB(): DBData {
  const getSnapshot = useCallback(() => db.get(), []);
  const getServer = useCallback(() => seedDb(), []);
  return useSyncExternalStore(dbSubscribe, getSnapshot, getServer);
}

// ── কার্ট এক্সটার্নাল স্টোর ──

export type CartView = { items: HydratedCartItem[]; subtotal: number; count: number };
const EMPTY_CART: CartView = { items: [], subtotal: 0, count: 0 };

class CartStore {
  private snapshot: CartView = EMPTY_CART;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      const refresh = () => {
        const next = getCart();
        if (
          next.count !== this.snapshot.count ||
          next.subtotal !== this.snapshot.subtotal ||
          next.items !== this.snapshot.items
        ) {
          this.snapshot = next;
          this.notify();
        }
      };
      window.addEventListener('tsb:cart', refresh);
      window.addEventListener('tsb:auth', refresh);
      db.subscribe(refresh);
      this.snapshot = getCart();
    }
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private notify(): void {
    for (const l of Array.from(this.listeners)) {
      try {
        l();
      } catch {
        // ignore
      }
    }
  }

  refresh = (): void => {
    if (typeof window === 'undefined') return;
    this.snapshot = getCart();
    this.notify();
  };

  get = (): CartView => this.snapshot;
}

export const cartStore = new CartStore();

/** কার্ট হাইড্রেটেড ভিউ */
export function useCartData(): CartView {
  const getServer = useCallback(() => EMPTY_CART, []);
  return useSyncExternalStore(cartStore.subscribe, cartStore.get, getServer);
}

// ── ইউজার এক্সটার্নাল স্টোর ──

export type CurrentUserView = { user: User | null; ready: boolean };
const GUEST_VIEW: CurrentUserView = { user: null, ready: false };

class UserStore {
  private snapshot: CurrentUserView = GUEST_VIEW;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      const refresh = () => {
        const user = getCurrentUser();
        const next: CurrentUserView = { user, ready: true };
        if (next.user !== this.snapshot.user || next.ready !== this.snapshot.ready) {
          this.snapshot = next;
          this.notify();
        }
      };
      window.addEventListener('tsb:auth', refresh);
      window.addEventListener('storage', refresh);
      db.subscribe(refresh);
      this.snapshot = { user: getCurrentUser(), ready: true };
    }
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private notify(): void {
    for (const l of Array.from(this.listeners)) {
      try {
        l();
      } catch {
        // ignore
      }
    }
  }

  refresh = (): void => {
    if (typeof window === 'undefined') return;
    const user = getCurrentUser();
    this.snapshot = { user, ready: true };
    this.notify();
  };

  get = (): CurrentUserView => this.snapshot;
}

export const userStore = new UserStore();

/** বর্তমান লগইন ইউজার (রিয়েক্টিভ) */
export function useCurrentUser(): CurrentUserView {
  const getServer = useCallback(() => GUEST_VIEW, []);
  return useSyncExternalStore(userStore.subscribe, userStore.get, getServer);
}

/** auth state পরিবর্তন ব্রডকাস্ট */
export function notifyAuthChanged(): void {
  if (typeof window !== 'undefined') {
    userStore.refresh();
    cartStore.refresh();
    window.dispatchEvent(new Event('tsb:auth'));
  }
}

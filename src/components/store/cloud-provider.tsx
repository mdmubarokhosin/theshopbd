'use client';

/**
 * THE SHOP BD — ক্লাউড প্রোভাইডার (root layout-এ মাউন্ট হয়)
 * ---------------------------------------------------------------------------
 * • Firebase Realtime Database সিঙ্ক ইঞ্জিন চালু করে (সোর্স অব ট্রুথ = RTDB)
 * • Firebase Auth স্টেট ব্রিজ চালু করে (Google/Email সেশন)
 * • Google Analytics চালু করে (সাপোর্টেড এনভায়রনমেন্টে)
 */

import { useEffect } from 'react';
import { initCloudSync } from '@/lib/db/cloud';
import { initFirebaseAuth } from '@/lib/db/auth';
import { db } from '@/lib/db/core';
import { initAnalytics } from '@/lib/firebase/app';

export function CloudProvider() {
  useEffect(() => {
    // হাইড্রেশন পাস শেষ — এরপরই localStorage/RTDB মিরর ডেটা UI-তে দেখানো হয়।
    // হাইড্রেশন চলাকালে সিড ডেটা দেখানো হয় যেন সার্ভার HTML-এর সাথে হুবহু মেলে
    // (React 19 hydration mismatch বন্ধ হয়)।
    db.markHydrated();
    const unsubs: (() => void)[] = [];
    try {
      unsubs.push(initCloudSync());
    } catch (err) {
      console.warn('cloud sync init failed', err);
    }
    try {
      unsubs.push(initFirebaseAuth());
    } catch (err) {
      console.warn('firebase auth init failed', err);
    }
    void initAnalytics();
    return () => {
      for (const u of unsubs) {
        try {
          u();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return null;
}

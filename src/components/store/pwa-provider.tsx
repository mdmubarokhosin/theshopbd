'use client';

/**
 * THE SHOP BD — PWA + Push Notification প্রোভাইডার
 * ---------------------------------------------------------------------------
 * • Service Worker রেজিস্টার (/sw.js — অফলাইন ক্যাশ + push + notificationclick)
 * • push_enabled + VAPID কী সেট থাকলে FCM টোকেন নিয়ে pushTokens কালেকশনে সেভ
 * • beforeinstallprompt ধরে "অ্যাপ ইনস্টল করুন" বাটন দেখায় (হেডারে ইভেন্ট ব্রডকাস্ট)
 * • সার্ভার webhooks নোড লিসেন — ক্রন/গেটওয়ে ইভেন্ট প্রসেস করে
 */

import { useEffect } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { firebaseDb } from '@/lib/firebase/app';
import { db } from '@/lib/db/core';
import { savePushToken, markCartReminded } from '@/lib/db/growth';
import { uid } from '@/lib/db/core';

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ── ১) Service Worker রেজিস্টার ──
    let swReg: ServiceWorkerRegistration | null = null;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          swReg = reg;
          tryPush(reg);
        })
        .catch(() => {
          // SW ব্যর্থ হলেও সাইট চলবে
        });
    }

    // ── ২) FCM পুশ টোকেন ──
    async function tryPush(reg: ServiceWorkerRegistration) {
      const settings = db.get().settings as unknown as Record<string, string>;
      if (settings.push_enabled !== '1') return;
      const vapid = (settings.push_vapid_key || '').trim();
      if (!vapid) return;
      if (!('Notification' in window)) return;
      if (Notification.permission === 'denied') return;
      try {
        if (Notification.permission !== 'granted') {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') return;
        }
        // ডাইনামিক ইমপোর্ট — ফায়ারবেস মেসেজিং বান্ডল দরকার হলেই লোড হয়
        const { getMessaging, getToken, onMessage, isSupported } = await import('firebase/messaging');
        if (!(await isSupported())) return;
        const messaging = getMessaging();
        const token = await getToken(messaging, {
          vapidKey: vapid,
          serviceWorkerRegistration: reg,
        });
        if (token) savePushToken(token);
        // ফোরগ্রাউন্ড মেসেজ → নোটিফিকেশন দেখাও
        onMessage(messaging, (payload) => {
          const n = payload.notification;
          if (n && Notification.permission === 'granted' && swReg) {
            void swReg.showNotification(n.title || 'THE SHOP BD', {
              body: n.body || '',
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-96.png',
              tag: payload.messageId ?? undefined,
            });
          }
        });
      } catch {
        // পুশ ঐচ্ছিক — ব্যর্থ হলে চুপচাপ এগিয়ে যাও
      }
    }

    // ── ৩) PWA ইনস্টল প্রম্পট ──
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __tsbInstallPrompt?: Event }).__tsbInstallPrompt = e;
      window.dispatchEvent(new Event('tsb:installable'));
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    const onInstalled = () => {
      (window as unknown as { __tsbInstallPrompt?: Event | null }).__tsbInstallPrompt = null;
      window.dispatchEvent(new Event('tsb:installable'));
    };
    window.addEventListener('appinstalled', onInstalled);

    // ── ৪) সার্ভার webhooks প্রসেসর (ক্রন SMS / গেটওয়ে ইভেন্ট) ──
    let detachHooks: (() => void) | null = null;
    const rtdb = firebaseDb();
    if (rtdb) {
      const hooksRef = ref(rtdb, 'webhooks');
      detachHooks = onValue(
        hooksRef,
        (snap) => {
          const val = snap.val() as Record<string, { type?: string; secret?: string; cartId?: string; smsOk?: boolean; to?: string; message?: string; template?: string; processed?: boolean }> | null;
          if (!val || typeof val !== 'object') return;
          const settings = db.get().settings as unknown as Record<string, string>;
          const expected = settings.webhook_secret || 'tsb-hook-change-me';
          for (const [key, hook] of Object.entries(val)) {
            if (!hook || hook.processed || !hook.type) continue;
            if (hook.secret !== expected) continue; // অননুমোদিত
            if (hook.type === 'ac_reminded') {
              if (hook.cartId) markCartReminded(hook.cartId);
              // SMS লগ সেভ (ক্রন থেকে পাঠানো হয়েছে)
              if (hook.to && hook.message) {
                db.append('smsLogs', {
                  id: uid('sms'),
                  to: hook.to,
                  message: hook.message,
                  template: hook.template ?? 'abandoned',
                  orderNumber: null,
                  status: hook.smsOk ? 'sent' : 'failed',
                  provider: 'cron',
                  error: hook.smsOk ? null : 'প্রোভাইডার ব্যর্থ',
                  createdAt: new Date().toISOString(),
                });
              }
            }
            // প্রসেসড মার্ক + ক্লিনআপ
            void remove(ref(rtdb, `webhooks/${key}`)).catch(() => undefined);
          }
        },
        () => {
          // webhooks নোডের রুল না থাকলেও সাইট চলবে
        }
      );
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      detachHooks?.();
    };
  }, []);

  return null;
}

/** "অ্যাপ ইনস্টল করুন" প্রম্পট — হেডার/অ্যাকাউন্ট থেকে কল হয় */
export async function promptPwaInstall(): Promise<'accepted' | 'unavailable'> {
  if (typeof window === 'undefined') return 'unavailable';
  const evt = (window as unknown as { __tsbInstallPrompt?: Event | null }).__tsbInstallPrompt;
  if (!evt) return 'unavailable';
  type InstallEvt = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };
  await (evt as InstallEvt).prompt();
  (window as unknown as { __tsbInstallPrompt?: Event | null }).__tsbInstallPrompt = null;
  return 'accepted';
}

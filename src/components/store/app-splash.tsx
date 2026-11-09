'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

const SPLASH_KEY = 'tsb_splash_shown';

/**
 * অ্যাপ স্প্ল্যাশ — প্রতি ব্রাউজার সেশনে একবারই দেখায় (sessionStorage ফ্ল্যাগ)।
 * সাইটের নাম/ট্যাগলাইন সেটিংস থেকে ডায়নামিক — অ্যাডমিন প্যানেল থেকে বদলালে এখানেও দেখাবে।
 * রিয়েল URL যুগে ইউজার যেকোনো পেজে সরাসরি ঢুকতে পারে — প্রতিবার স্প্ল্যাশ
 * দেখালে অ্যানয়িং হতো; তাই প্রথম লোডে একবার, পরের লোডে সরাসরি পেজ।
 */
export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const settings = useStore((s) => s.siteSettings);
  const siteTitle = settings.site_title || 'THE SHOP BD';
  const siteTagline = settings.site_tagline || 'মাল্টিব্র্যান্ড অনলাইন শপিং';
  const siteLogo = settings.site_logo;

  const parts = siteTitle.split(' ');
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : siteTitle;
  const last = parts.length > 1 ? parts[parts.length - 1] : '';

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY)) return;
      sessionStorage.setItem(SPLASH_KEY, '1');
    } catch {
      return; // sessionStorage না থাকলে স্প্ল্যাশ বাদ
    }
    // setState ইফেক্ট বডিতে সরাসরি নয় — টাইমার কলব্যাকে (cascading render এড়াতে)
    const t0 = setTimeout(() => setVisible(true), 0);
    const t1 = setTimeout(() => setExiting(true), 1100);
    const t2 = setTimeout(() => setVisible(false), 1600);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background ${exiting ? 'splash-exit' : ''}`}
      aria-hidden="true"
    >
      <div className="splash-logo flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-xl">
        {siteLogo ? (
          <img src={siteLogo} alt={siteTitle} className="h-full w-full rounded-3xl object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-14 w-14 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {/* shopping bag */}
            <path d="M6 7h12l1.2 12.2a2 2 0 0 1-2 2.2H6.8a2 2 0 0 1-2-2.2L6 7Z" />
            <path d="M9 10V6a3 3 0 0 1 6 0v4" />
          </svg>
        )}
      </div>
      <div className="mt-4 text-2xl font-extrabold text-primary">
        {last ? (
          <>
            {first} <span className="text-honey">{last}</span>
          </>
        ) : (
          siteTitle
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{siteTagline}</div>
    </div>
  );
}

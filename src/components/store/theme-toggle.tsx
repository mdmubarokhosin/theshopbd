'use client';

/**
 * থিম টগল — অটো (সিস্টেম অনুযায়ী) / লাইট / ডার্ক
 * ---------------------------------------------------------------------------
 * • ডিফল্ট: অটো — ডিভাইসের prefers-color-scheme ফলো করে।
 * • ইউজারের পছন্দ localStorage 'tsb_theme' এ সেভ হয়।
 * • একাধিক টগল বাটন সিঙ্ক হয় 'tsb-theme-change' ইভেন্টে।
 * • লেআউটের ইনলাইন স্ক্রিপ্ট প্রথম পেইন্টের আগেই ক্লাস সেট করে (ফ্ল্যাশ নেই)।
 */
import { useCallback, useSyncExternalStore } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export type ThemeMode = 'auto' | 'light' | 'dark';
const KEY = 'tsb_theme';
const EVENT = 'tsb-theme-change';

export function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  const dark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function getThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // ignore
  }
  applyTheme(mode);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

export function ThemeToggle({ className }: { className?: string }) {
  // এক্সটার্নাল স্টোর (localStorage + কাস্টম ইভেন্ট + ক্রস-ট্যাব storage) — useSyncExternalStore
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener(EVENT, cb);
    window.addEventListener('storage', cb);
    return () => {
      window.removeEventListener(EVENT, cb);
      window.removeEventListener('storage', cb);
    };
  }, []);
  const mode = useSyncExternalStore(subscribe, getThemeMode, () => 'auto' as ThemeMode);

  const cycle = () => {
    const next: ThemeMode = mode === 'auto' ? 'dark' : mode === 'dark' ? 'light' : 'auto';
    setThemeMode(next);
    const label = next === 'auto' ? 'সিস্টেম অনুযায়ী (অটো)' : next === 'dark' ? 'ডার্ক মোড' : 'লাইট মোড';
    toast({ title: 'থিম পরিবর্তন', description: label });
  };

  const Icon = mode === 'auto' ? Monitor : mode === 'dark' ? Moon : Sun;
  const label = mode === 'auto' ? 'অটো থিম' : mode === 'dark' ? 'ডার্ক মোড' : 'লাইট মোড';

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={cycle}
      aria-label={`থিম: ${label} — ট্যাপ করে বদলান`}
      title={`থিম: ${label}`}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}

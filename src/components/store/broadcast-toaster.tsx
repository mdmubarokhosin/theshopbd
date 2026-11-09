'use client';

/**
 * রিয়েল-টাইম ব্রডকাস্ট নোটিফিকেশন পপআপ
 * ─────────────────────────────────────────────────────────────────────
 * অ্যাডমিন প্যানেল (মার্কেটিং → ব্রডকাস্ট নোটিফিকেশন) থেকে বার্তা পাঠালে
 * সাইটের সব ওপেন ট্যাবে সঙ্গে সঙ্গে টোস্ট পপআপ দেখায়:
 *
 *   RTDB সিঙ্ক → লোকাল মিরর (db) → useCollection রি-রেন্ডার → টোস্ট
 *
 * • প্রথম লোডে পুরোনো ব্রডকাস্টে স্প্যাম করে না — শুধু নতুন আসলেই দেখায়
 * • সর্বশেষ দেখা ব্রডকাস্টের সময় localStorage-এ রাখা হয় (প্রতি ব্রাউজারে একবার)
 * • ইউজার লগইন থাকুক বা না থাকুক — ব্রডকাস্ট (userId: null) সবাই পায়
 */

import { useEffect, useRef } from 'react';
import { useCollection } from '@/lib/db/hooks';
import { toast } from '@/hooks/use-toast';

/** সর্বশেষ দেখা ব্রডকাস্টের createdAt — localStorage কী */
const SEEN_KEY = 'tsb_broadcast_seen_v1';

type NotifLike = {
  id: string;
  userId?: string | null;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read?: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  promo: '🎉 অফার',
  system: '🔔 নোটিশ',
  stock: '📦 স্টক',
};

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(iso: string): void {
  try {
    localStorage.setItem(SEEN_KEY, iso);
  } catch {
    // ignore
  }
}

export function BroadcastToaster() {
  const notifications = useCollection('notifications') as NotifLike[];
  const baselineRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    // ব্রডকাস্ট = userId নেই (সবার জন্য) — RTDB রাউন্ড-ট্রিপে null → undefined হয়
    const broadcasts = notifications
      .filter((n) => n.userId == null)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    // প্রথম পাস — পুরোনো ব্রডকাস্ট বেসলাইন হিসেবে সেভ (স্প্যাম বন্ধ)
    if (!mountedRef.current) {
      mountedRef.current = true;
      const stored = readSeen();
      const latest = broadcasts[0]?.createdAt ?? null;
      // localStorage-এর টাইমস্ট্যাম্প রিমোটের চেয়ে নতুন হলে সেটাই বেসলাইন
      baselineRef.current =
        stored && (!latest || stored >= latest) ? stored : latest;
      return;
    }

    // পরবর্তী পাস — বেসলাইনের চেয়ে নতুন ব্রডকাস্ট এলে পপআপ
    const baseline = baselineRef.current ?? '';
    const fresh = broadcasts.filter((n) => n.createdAt > baseline);
    if (fresh.length === 0) return;

    const newest = fresh[0];
    baselineRef.current = newest.createdAt;
    writeSeen(newest.createdAt);

    const label = TYPE_LABEL[newest.type] ?? TYPE_LABEL.system;
    toast({
      title: newest.title,
      description: (
        <span className="block max-w-sm">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-primary">
            {label}
          </span>
          {newest.message}
        </span>
      ),
      duration: 10000,
    });
  }, [notifications]);

  return null;
}

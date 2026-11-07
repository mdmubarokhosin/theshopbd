'use client';

/**
 * অ্যাডমিন — গ্রোথ ও রিটেনশন সেকশনসমূহ
 * ---------------------------------------------------------------------------
 * • AdminLoyalty   — লয়ালটি পয়েন্ট সেটিং + কাস্টমার ব্যালেন্স + ম্যানুয়াল সমন্বয়
 * • AdminReferral  — রেফারেল কমিশন সেটিং + ইভেন্ট + উইথড্র আবেদন প্রসেস
 * • AdminAbandoned — অ্যাব্যান্ডন্ড কার্ট সেটিং + তালিকা + SMS/WhatsApp রিমাইন্ডার
 */

import { useMemo, useState } from 'react';
import {
  Save, Sparkles, Gift, Users, Wallet, TrendingUp, Send, CheckCircle2, XCircle,
  Loader2, MessageCircle, Phone, BellRing, Search, Inbox, Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useSettings, useCurrentUser } from '@/lib/db/hooks';
import { saveSettings } from '@/lib/db/services';
import { db } from '@/lib/db/core';
import {
  loyaltyBalanceOf, adjustLoyalty, referralBalanceOf, processReferralWithdraw,
  abandonedCartSmsText, sendSms, markCartReminded,
} from '@/lib/db/growth';
import { formatBDT, toBn, formatBnDate } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { SiteSettings, User } from '@/lib/db/types';

type SKey = keyof SiteSettings;

// ═══════════════════════ লয়ালটি পয়েন্ট ═══════════════════════

export function AdminLoyalty() {
  const { toast } = useToast();
  const settings = useSettings();
  const [f, setF] = useState<Record<string, string>>({
    loyalty_enabled: settings.loyalty_enabled,
    loyalty_earn_rate: settings.loyalty_earn_rate,
    loyalty_point_value: settings.loyalty_point_value,
    loyalty_min_redeem: settings.loyalty_min_redeem,
    loyalty_max_percent: settings.loyalty_max_percent,
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [adjustOpen, setAdjustOpen] = useState<string | null>(null);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const set = (k: SKey) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(f as Partial<SiteSettings>);
      toast({ title: 'লয়ালটি সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  const customers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db
      .collection('users')
      .filter((u) => u.roleId === 'customer')
      .filter((u) => !q || u.name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').includes(q))
      .map((u) => ({ user: u, balance: loyaltyBalanceOf(u.id) }))
      .sort((a, b) => b.balance - a.balance);
  }, [search]);

  const ledger = useMemo(
    () => db.collection('loyaltyLedger').slice(0, 25),
    []
  );

  const doAdjust = (userId: string) => {
    const pts = Number(adjustPoints) || 0;
    if (!pts) return toast({ title: 'পয়েন্ট লিখুন', variant: 'destructive' });
    const ok = adjustLoyalty(userId, pts, adjustReason || 'অ্যাডমিন সমন্বয়');
    if (!ok) return toast({ title: 'ব্যর্থ — ব্যালেন্স ঋণাত্মক হতে পারে না', variant: 'destructive' });
    toast({ title: `${pts > 0 ? '+' : ''}${pts} পয়েন্ট সমন্বয় হয়েছে` });
    setAdjustOpen(null);
    setAdjustPoints('');
    setAdjustReason('');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Sparkles className="h-5 w-5 text-primary" /> লয়ালটি পয়েন্ট সেটিংস</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3.5 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold">লয়ালটি পয়েন্ট চালু</p>
              <p className="text-xs text-muted-foreground">কাস্টমার অর্ডারে পয়েন্ট পাবে ও ছাড় হিসেবে খরচ করতে পারবে</p>
            </div>
            <Switch checked={f.loyalty_enabled === '1'} onCheckedChange={(v) => set('loyalty_enabled')(v ? '1' : '0')} />
          </div>
          <div>
            <Label>প্রতি ১০০৳-এ পয়েন্ট</Label>
            <Input className="mt-1.5" inputMode="numeric" value={f.loyalty_earn_rate} onChange={(e) => set('loyalty_earn_rate')(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <Label>১ পয়েন্টের মান (৳)</Label>
            <Input className="mt-1.5" inputMode="decimal" value={f.loyalty_point_value} onChange={(e) => set('loyalty_point_value')(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
          <div>
            <Label>সর্বনিম্ন খরচযোগ্য পয়েন্ট</Label>
            <Input className="mt-1.5" inputMode="numeric" value={f.loyalty_min_redeem} onChange={(e) => set('loyalty_min_redeem')(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <Label>অর্ডারের সর্বোচ্চ কত % পয়েন্টে</Label>
            <Input className="mt-1.5" inputMode="numeric" value={f.loyalty_max_percent} onChange={(e) => set('loyalty_max_percent')(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <Button className="mt-4 gap-1.5" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
        </Button>
      </div>

      {/* কাস্টমার ব্যালেন্স */}
      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <h2 className="flex items-center gap-2 font-bold"><Users className="h-5 w-5 text-primary" /> কাস্টমার পয়েন্ট ({toBn(customers.length)})</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম/ইমেইল/ফোন" className="h-9 w-52 pl-8" />
          </div>
        </div>
        <div className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
          {customers.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">কোনো কাস্টমার নেই</p>}
          {customers.map(({ user, balance }) => (
            <div key={user.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.phone || user.email || '—'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-extrabold text-primary">{toBn(balance)} pts</span>
                <Button variant="outline" size="sm" onClick={() => { setAdjustOpen(adjustOpen === user.id ? null : user.id); setAdjustPoints(''); }}>
                  সমন্বয়
                </Button>
              </div>
            </div>
          ))}
        </div>
        {adjustOpen && (
          <div className="border-t bg-muted/40 p-4">
            <div className="grid gap-2 sm:grid-cols-[110px_1fr_auto]">
              <Input placeholder="+১০০ / −৫০" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value.replace(/[^\d-]/g, ''))} />
              <Input placeholder="কারণ (ঐচ্ছিক)" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
              <Button onClick={() => doAdjust(adjustOpen)} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> প্রয়োগ</Button>
            </div>
          </div>
        )}
      </div>

      {/* সাম্প্রতিক লেজার */}
      <div className="rounded-xl border bg-card">
        <h2 className="border-b p-4 font-bold">সাম্প্রতিক লেনদেন</h2>
        <div className="max-h-72 divide-y overflow-y-auto scrollbar-thin">
          {ledger.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">এখনো কোনো লেনদেন নেই</p>}
          {ledger.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.userName || e.userId} — {e.reason}</p>
                <p className="text-[11px] text-muted-foreground">{formatBnDate(e.createdAt)}</p>
              </div>
              <span className={cn('shrink-0 text-sm font-bold', e.points >= 0 ? 'text-green-600' : 'text-destructive')}>
                {e.points >= 0 ? '+' : '−'}{toBn(Math.abs(e.points))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ রেফারেল ═══════════════════════

export function AdminReferral() {
  const { toast } = useToast();
  const settings = useSettings();
  const [f, setF] = useState<Record<string, string>>({
    referral_enabled: settings.referral_enabled,
    referral_percent: settings.referral_percent,
    referral_first_only: settings.referral_first_only,
    referral_min_withdraw: settings.referral_min_withdraw,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: SKey) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(f as Partial<SiteSettings>);
      toast({ title: 'রেফারেল সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  const events = useMemo(() => db.collection('referralEvents').slice(0, 50), []);
  const withdraws = useMemo(() => db.collection('referralWithdraws').filter((w) => w.status === 'PENDING'), []);
  const allWithdraws = useMemo(() => db.collection('referralWithdraws').slice(0, 30), []);
  const topReferrers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const e of db.collection('referralEvents')) {
      const cur = map.get(e.referrerUserId) ?? { name: e.referrerName || e.referrerUserId, total: 0, count: 0 };
      cur.total += e.commission;
      cur.count += 1;
      map.set(e.referrerUserId, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, []);

  const process = (id: string, status: 'PAID' | 'REJECTED') => {
    processReferralWithdraw(id, status);
    toast({ title: status === 'PAID' ? 'পরিশোধিত মার্ক করা হয়েছে' : 'আবেদন বাতিল করা হয়েছে' });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Gift className="h-5 w-5 text-primary" /> রেফারেল কমিশন সেটিংস</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3.5 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold">রেফারেল প্রোগ্রাম চালু</p>
              <p className="text-xs text-muted-foreground">কাস্টমার কোড শেয়ার করে কমিশন আর্জন করবে</p>
            </div>
            <Switch checked={f.referral_enabled === '1'} onCheckedChange={(v) => set('referral_enabled')(v ? '1' : '0')} />
          </div>
          <div>
            <Label>কমিশন (%)</Label>
            <Input className="mt-1.5" inputMode="numeric" value={f.referral_percent} onChange={(e) => set('referral_percent')(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <Label>সর্বনিম্ন তোলা (৳)</Label>
            <Input className="mt-1.5" inputMode="numeric" value={f.referral_min_withdraw} onChange={(e) => set('referral_min_withdraw')(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3.5 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold">শুধু প্রথম অর্ডারে কমিশন</p>
              <p className="text-xs text-muted-foreground">বন্ধ করলে প্রতিটি ডেলিভার্ড অর্ডারে কমিশন যাবে</p>
            </div>
            <Switch checked={f.referral_first_only === '1'} onCheckedChange={(v) => set('referral_first_only')(v ? '1' : '0')} />
          </div>
        </div>
        <Button className="mt-4 gap-1.5" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
        </Button>
      </div>

      {/* উইথড্র আবেদন */}
      <div className="rounded-xl border bg-card">
        <h2 className="flex items-center gap-2 border-b p-4 font-bold"><Wallet className="h-5 w-5 text-primary" /> তোলার আবেদন {withdraws.length > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">{toBn(withdraws.length)}</span>}</h2>
        <div className="max-h-80 divide-y overflow-y-auto scrollbar-thin">
          {allWithdraws.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">কোনো আবেদন নেই</p>}
          {allWithdraws.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{w.userName || w.userId} — {formatBDT(w.amount)}</p>
                <p className="text-[11px] text-muted-foreground">{w.method} · {w.account} · {formatBnDate(w.createdAt)}</p>
              </div>
              {w.status === 'PENDING' ? (
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => process(w.id, 'PAID')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> পরিশোধ
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => process(w.id, 'REJECTED')}>
                    <XCircle className="h-3.5 w-3.5" /> বাতিল
                  </Button>
                </div>
              ) : (
                <span className="text-xs font-bold text-muted-foreground">{w.status === 'PAID' ? '✓ পরিশোধিত' : '✗ বাতিল'}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* টপ রেফারার */}
        <div className="rounded-xl border bg-card">
          <h2 className="flex items-center gap-2 border-b p-4 font-bold"><TrendingUp className="h-5 w-5 text-primary" /> টপ রেফারার</h2>
          <div className="max-h-72 divide-y overflow-y-auto scrollbar-thin">
            {topReferrers.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">এখনো কোনো রেফারেল নেই</p>}
            {topReferrers.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{toBn(i + 1)}</span>
                  <div>
                    <p className="text-sm font-semibold">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">{toBn(r.count)} সফল রেফার</p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-primary">{formatBDT(r.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* কমিশন ইভেন্ট */}
        <div className="rounded-xl border bg-card">
          <h2 className="border-b p-4 font-bold">কমিশন ইভেন্ট</h2>
          <div className="max-h-72 divide-y overflow-y-auto scrollbar-thin">
            {events.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">এখনো কোনো ইভেন্ট নেই</p>}
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.referrerName || '—'} ← {e.referredName || '—'}</p>
                  <p className="text-[11px] text-muted-foreground">{e.orderNumber} · {formatBnDate(e.createdAt)}</p>
                </div>
                <span className="text-sm font-bold text-green-600">+{formatBDT(e.commission)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ অ্যাব্যান্ডন্ড কার্ট ═══════════════════════

export function AdminAbandoned() {
  const { toast } = useToast();
  const settings = useSettings();
  const [f, setF] = useState<Record<string, string>>({
    ac_enabled: settings.ac_enabled,
    ac_threshold: settings.ac_threshold,
    ac_offer_text: settings.ac_offer_text,
  });
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const set = (k: SKey) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(f as Partial<SiteSettings>);
      toast({ title: 'সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  const thresholdMin = Number(f.ac_threshold) || 60;
  const carts = useMemo(() => {
    const now = Date.now();
    return db
      .collection('abandonedCarts')
      .filter((c) => c.status === 'open' || c.status === 'reminded')
      .filter((c) => now - Date.parse(c.updatedAt || '') > thresholdMin * 60_000)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [thresholdMin]);

  const waLink = (phone: string) => {
    const wa = (settings.wa_phone || settings.contact_phone || '').replace(/\D/g, '');
    void wa;
    return `https://wa.me/${(phone || '').replace(/^0/, '880')}?text=${encodeURIComponent(
      `আপনার কার্টে পণ্য অপেক্ষা করছে! ${f.ac_offer_text || ''} — ${settings.site_title || ''}`
    )}`;
  };

  const sendReminder = async (cartId: string, phone: string) => {
    const cart = db.findById('abandonedCarts', cartId);
    if (!cart || !phone) return;
    setSendingId(cartId);
    const res = await sendSms({
      to: phone,
      message: abandonedCartSmsText(cart),
      template: 'abandoned',
    });
    setSendingId(null);
    if (res.ok) {
      markCartReminded(cartId);
      toast({ title: 'রিমাইন্ডার SMS পাঠানো হয়েছে' });
    } else {
      toast({ title: 'SMS ব্যর্থ', description: res.error, variant: 'destructive' });
    }
  };

  const dismiss = (cartId: string) => {
    const c = db.findById('abandonedCarts', cartId);
    if (c) db.put('abandonedCarts', { ...c, status: 'dismissed' });
    toast({ title: 'তালিকা থেকে বাদ দেওয়া হয়েছে' });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><BellRing className="h-5 w-5 text-primary" /> অ্যাব্যান্ডন্ড কার্ট সেটিংস</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3.5 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold">ট্র্যাকিং চালু</p>
              <p className="text-xs text-muted-foreground">কার্টে ফেলে চলে যাওয়া ক্রেতাদের ট্র্যাক করা হবে</p>
            </div>
            <Switch checked={f.ac_enabled === '1'} onCheckedChange={(v) => set('ac_enabled')(v ? '1' : '0')} />
          </div>
          <div>
            <Label>কত মিনিট পরে "অ্যাব্যান্ডন্ড"</Label>
            <Input className="mt-1.5" inputMode="numeric" value={f.ac_threshold} onChange={(e) => set('ac_threshold')(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <Label>SMS-এ অফার লাইন (ঐচ্ছিক)</Label>
            <Input className="mt-1.5" value={f.ac_offer_text} onChange={(e) => set('ac_offer_text')(e.target.value)} placeholder="যেমন: ১০% ছাড় কুপন SAVE10" />
          </div>
        </div>
        <Button className="mt-4 gap-1.5" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <h2 className="flex items-center gap-2 border-b p-4 font-bold"><Inbox className="h-5 w-5 text-primary" /> অপেক্ষমাণ কার্ট ({toBn(carts.length)})</h2>
        <div className="max-h-[28rem] divide-y overflow-y-auto scrollbar-thin">
          {carts.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">এই মুহূর্তে কোনো অ্যাব্যান্ডন্ড কার্ট নেই</p>}
          {carts.map((c) => (
            <div key={c.id} className="p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {c.name} {c.phone && <span className="font-normal text-muted-foreground">· {c.phone}</span>}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Timer className="h-3 w-3" /> সর্বশেষ আপডেট {formatBnDate(c.updatedAt)}
                    {c.remindedCount > 0 && ` · ${toBn(c.remindedCount)} বার রিমাইন্ডার`}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {c.items.map((i) => `${i.name} ×${i.qty}`).join(', ')} — <strong className="text-primary">{formatBDT(c.subtotal)}</strong>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {c.phone && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => sendReminder(c.id, c.phone!)} disabled={sendingId === c.id}>
                        {sendingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} SMS
                      </Button>
                      <a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1 text-[#128C7E]">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </Button>
                      </a>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => dismiss(c.id)}>
                    <XCircle className="h-3.5 w-3.5" /> বাদ
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="rounded-xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        💡 <strong>অটো-রিমাইন্ডার:</strong> cron-job.org (ফ্রি)-তে একটি জব যোগ করুন —
        URL: <code className="rounded bg-muted px-1">https://আপনার-ডোমেইন.com/api/cron/abandoned?secret=আপনার-webhook-secret</code>, ঘণ্টায় একবার।
        সেটিংস ব্যবহারকারীর ফোন না থাকলে SMS যাবে না (লগইন করা ক্রেতাদের নম্বর সেভ থাকলে সেটাই ব্যবহার হয়)।
      </p>
    </div>
  );
}

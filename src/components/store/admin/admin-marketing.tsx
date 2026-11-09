'use client';

/**
 * অ্যাডমিন — মার্কেটিং সেকশন
 * ─────────────────────────────────────────────────────────────────────
 * • ফ্ল্যাশ সেল — চালু/বন্ধ, শিরোনাম, শেষ সময়, পণ্য নির্বাচন
 *   → হোমপেজে রিয়েল-টাইম কাউন্টডাউন সহ সেকশন দেখায় (RTDB সিঙ্ক)
 * • ব্রডকাস্ট নোটিফিকেশন — সব ইউজারের বেল + রিয়েল-টাইম টোস্ট পপআপে যায়
 * • ব্রডকাস্ট ম্যানেজমেন্ট — পাঠানো নোটিফিকেশনের সম্পূর্ণ কন্ট্রোল:
 *   এডিট (শিরোনাম/বার্তা/ধরন), ডিলিট (একক/সব), আবার পাঠানো (রিসেন্ড)
 * • প্রোমো টুলস (ফাংশনাল কুইক-কন্ট্রোল):
 *   - স্লাইডিং ঘোষণা বার মাস্টার সুইচ
 *   - নোটিশ পপআপ / অফার পপআপ চালু-বন্ধ
 *   - কুপন ওভারভিউ (সক্রিয়, ব্যবহার, শীঘ্রই শেষ হবে)
 */

import { useMemo, useState } from 'react';
import {
  Zap, Megaphone, Send, Search, CheckSquare, Square, Clock,
  Ticket, ChevronRight, History, BellRing, Image as ImageIcon, Sparkles, Tag,
  Pencil, Trash2, RotateCcw, Check, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db/core';
import { useCollection, useDB, useSettings } from '@/lib/db/hooks';
import {
  sendBroadcastNotification, updateNotification, deleteNotification,
  resendBroadcastNotification, clearAllBroadcasts, saveSettings,
} from '@/lib/db/services';
import { formatBDT, toBn, formatBnDate } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { SiteSettings, Notification } from '@/lib/db/types';
import type { Section } from './sections';

function getProductImages(images: string): string[] {
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return images ? [images] : [];
  }
}

/** ISO → datetime-local ইনপুট ভ্যালু */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local ভ্যালু → ISO */
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ───────────────────────────── ফ্ল্যাশ সেল ─────────────────────────────

function FlashSaleCard() {
  const { toast } = useToast();
  const data = useDB();
  // RTDB রাউন্ড-ট্রিপে আংশিক অবজেক্ট আসলেও ক্র্যাশ না করে ডিফল্ট নেওয়া হয়
  const flashSale = data.flashSale ?? { enabled: false, title: 'ফ্ল্যাশ সেল', endsAt: null, productIds: [] as string[] };
  const safeProductIds = Array.isArray(flashSale.productIds) ? flashSale.productIds : [];
  const products = useCollection('products');

  const [enabled, setEnabled] = useState(flashSale.enabled);
  const [title, setTitle] = useState(flashSale.title);
  const [endsAtInput, setEndsAtInput] = useState(isoToLocalInput(flashSale.endsAt));
  const [picked, setPicked] = useState<string[]>(safeProductIds);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // বাইরে থেকে ডেটা বদলালে ফর্ম সিঙ্ক (রেন্ডার-টাইম অ্যাডজাস্ট)
  const [syncedFlash, setSyncedFlash] = useState(flashSale);
  if (syncedFlash !== flashSale) {
    setSyncedFlash(flashSale);
    setEnabled(flashSale.enabled);
    setTitle(flashSale.title);
    setEndsAtInput(isoToLocalInput(flashSale.endsAt));
    setPicked(Array.isArray(flashSale.productIds) ? flashSale.productIds : []);
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...products];
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.nameBn || p.name).toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q),
    );
  }, [products, search]);

  const toggleProduct = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = () => {
    setSaving(true);
    try {
      if (enabled && picked.length === 0) {
        toast({ title: 'অন্তত একটি পণ্য নির্বাচন করুন', variant: 'destructive' });
        return;
      }
      if (enabled && !endsAtInput) {
        toast({ title: 'শেষ সময় দিন', description: 'সময় শেষ না দিলে হোমপেজে কাউন্টডাউন সহ সেকশন দেখাবে না', variant: 'destructive' });
        return;
      }
      db.updateFlashSale({
        enabled,
        title: title.trim() || 'ফ্ল্যাশ সেল',
        endsAt: localInputToIso(endsAtInput),
        productIds: picked,
      });
      toast({
        title: enabled ? 'ফ্ল্যাশ সেল চালু হয়েছে' : 'ফ্ল্যাশ সেল বন্ধ হয়েছে',
        description: enabled
          ? `${toBn(picked.length)}টি পণ্য নির্বাচিত — হোমপেজে কাউন্টডাউন সহ দেখা যাবে`
          : 'হোমপেজ থেকে সেকশনটি সরে গেছে',
      });
    } finally {
      setSaving(false);
    }
  };

  const activeNow = enabled && flashSale.endsAt && new Date(flashSale.endsAt).getTime() > Date.now();

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Zap className="h-4 w-4" />
          </span>
          <span className="truncate">ফ্ল্যাশ সেল</span>
        </h3>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="ফ্ল্যাশ সেল চালু/বন্ধ" />
          {enabled ? 'চালু' : 'বন্ধ'}
        </label>
      </div>

      <div className={cn('grid gap-4', !enabled && 'opacity-60')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>শিরোনাম</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="বিশাল ফ্ল্যাশ সেল!" className="mt-1.5" />
          </div>
          <div>
            <Label>শেষ সময়</Label>
            <Input type="datetime-local" value={endsAtInput} onChange={(e) => setEndsAtInput(e.target.value)} className="mt-1.5" />
            {activeNow ? (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                <Clock className="h-3 w-3" /> চলছে — শেষ হবে: {flashSale.endsAt ? formatBnDate(flashSale.endsAt) : '—'}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">সময় শেষ হলে হোমপেজ থেকে সরে যাবে</p>
            )}
          </div>
        </div>

        {/* Product picker */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label>পণ্য নির্বাচন করুন</Label>
            <Badge variant="secondary" className="shrink-0 text-[10px]">{toBn(picked.length)}টি নির্বাচিত</Badge>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="পণ্য খুঁজুন..." className="pl-9" inputMode="search" />
          </div>
          <ScrollArea className="max-h-64 rounded-lg border">
            <div className="divide-y">
              {filteredProducts.map((p) => {
                const checked = picked.includes(p.id);
                const img = getProductImages(p.images)[0];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className={cn('flex min-h-11 w-full items-center gap-2.5 p-2.5 text-left transition-colors hover:bg-accent sm:gap-3', checked && 'bg-primary/5')}
                    aria-pressed={checked}
                  >
                    {checked ? <CheckSquare className="h-4 w-4 shrink-0 text-primary" /> : <Square className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {img ? (
                        <img src={img} alt={p.nameBn || p.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Zap className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium sm:text-[13px]">{p.nameBn || p.name}</span>
                    <span className="shrink-0 text-xs font-bold text-primary">{formatBDT(p.price)}</span>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">কোনো পণ্য মেলেনি</p>
              )}
            </div>
          </ScrollArea>
          {picked.length > 0 && (
            <button
              type="button"
              onClick={() => setPicked([])}
              className="mt-2 text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline"
            >
              সব নির্বাচন মুছুন ({toBn(picked.length)})
            </button>
          )}
        </div>

        <Button onClick={save} disabled={saving} className="w-full font-semibold sm:w-40">সেভ করুন</Button>
      </div>
    </div>
  );
}

// ───────────────────────────── ব্রডকাস্ট নোটিফিকেশন ─────────────────────────────

const NOTIF_TYPE_BN: Record<string, string> = {
  promo: 'প্রোমো',
  system: 'সিস্টেম',
  stock: 'স্টক',
};

const BROADCAST_TYPE_BADGE: Record<string, string> = {
  promo: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  system: 'bg-primary/10 text-primary',
  stock: 'bg-muted text-muted-foreground',
};

function BroadcastCard() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('promo');

  const send = () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: 'শিরোনাম ও বার্তা দিন', variant: 'destructive' });
      return;
    }
    sendBroadcastNotification({ title: title.trim(), message: message.trim(), type: type as 'promo' | 'system' | 'stock' });
    toast({
      title: 'ব্রডকাস্ট পাঠানো হয়েছে',
      description: 'সাইটের সব ওপেন ট্যাবে সঙ্গে সঙ্গে পপআপ দেখাবে এবং বেলে যোগ হবে — নিচের তালিকা থেকে যেকোনো সময় এডিট/ডিলিট করা যাবে',
    });
    setTitle('');
    setMessage('');
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Megaphone className="h-4 w-4" />
        </span>
        ব্রডকাস্ট নোটিফিকেশন
      </h3>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <div>
            <Label>শিরোনাম</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: বিশাল ছাড় চলছে!" className="mt-1.5" />
          </div>
          <div>
            <Label>ধরন</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="promo">প্রোমো</SelectItem>
                <SelectItem value="system">সিস্টেম</SelectItem>
                <SelectItem value="stock">স্টক</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>বার্তা</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="ইউজারদের যে বার্তা দেখাবে..." className="mt-1.5" />
        </div>
        <Button onClick={send} className="w-full gap-1.5 font-semibold sm:w-40">
          <Send className="h-4 w-4" /> পাঠান
        </Button>
      </div>
    </div>
  );
}

/**
 * ব্রডকাস্ট ম্যানেজমেন্ট — পাঠানো নোটিফিকেশনের সম্পূর্ণ কন্ট্রোল
 * • এডিট — শিরোনাম/বার্তা/ধরন ইনলাইন পরিবর্তন (বেল ও তালিকায় সাথে সাথে আপডেট)
 * • ডিলিট — একক ডিলিট (কনফার্ম সহ) + সব ব্রডকাস্ট একসাথে মুছা
 * • রিসেন্ড — পুরোনো বার্তা নতুন টাইমস্ট্যাম্পে আবার পাঠানো (সব ট্যাবে পপআপ আবার)
 */
function BroadcastManager() {
  const { toast } = useToast();
  const notifications = useCollection('notifications');
  const broadcasts = useMemo(
    () =>
      notifications
        .filter((n) => n.userId == null)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [notifications],
  );

  // এডিট স্টেট (একসাথে একটাই আইটেম এডিট মোডে থাকে)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editType, setEditType] = useState('promo');

  // ডিলিট কনফার্ম স্টেট
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const startEdit = (n: Notification) => {
    setEditingId(n.id);
    setEditTitle(n.title);
    setEditMessage(n.message);
    setEditType(n.type);
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (!editTitle.trim() || !editMessage.trim()) {
      toast({ title: 'শিরোনাম ও বার্তা দিন', variant: 'destructive' });
      return;
    }
    const res = updateNotification(editingId, {
      title: editTitle,
      message: editMessage,
      type: editType as Notification['type'],
    });
    if (res.ok) {
      toast({
        title: 'নোটিফিকেশন আপডেট হয়েছে',
        description: 'সব ইউজারের বেল ও নোটিফিকেশন তালিকায় নতুন লেখা দেখা যাবে',
      });
      setEditingId(null);
    } else {
      toast({ title: res.error ?? 'আপডেট হয়নি', variant: 'destructive' });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const res = deleteNotification(deleteTarget.id);
    if (editingId === deleteTarget.id) setEditingId(null);
    setDeleteTarget(null);
    if (res.ok) {
      toast({ title: 'নোটিফিকেশন ডিলিট হয়েছে', description: 'সব ইউজারের বেল থেকেও সরে গেছে' });
    } else {
      toast({ title: res.error ?? 'ডিলিট হয়নি', variant: 'destructive' });
    }
  };

  const resend = (n: Notification) => {
    const res = resendBroadcastNotification(n.id);
    if (res.ok) {
      toast({
        title: 'আবার পাঠানো হয়েছে',
        description: 'সব ওপেন ট্যাবে পপআপ আবার দেখাবে এবং বেলে নতুন এন্ট্রি যোগ হবে',
      });
    } else {
      toast({ title: res.error ?? 'পাঠানো যায়নি', variant: 'destructive' });
    }
  };

  const clearAll = () => {
    const count = clearAllBroadcasts();
    setConfirmClear(false);
    setEditingId(null);
    toast({
      title: count > 0 ? `${toBn(count)}টি ব্রডকাস্ট মুছে ফেলা হয়েছে` : 'মুছার মতো কিছু নেই',
      description: count > 0 ? 'সব ইউজারের বেল থেকেও সরে গেছে' : undefined,
    });
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <History className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold">ব্রডকাস্ট ম্যানেজমেন্ট</h3>
        {broadcasts.length > 0 && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">{toBn(broadcasts.length)}টি</Badge>
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        পাঠানো নোটিফিকেশন এডিট, ডিলিট, আবার পাঠানো — সম্পূর্ণ কন্ট্রোল
      </p>

      {broadcasts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          এখনো কোনো ব্রডকাস্ট পাঠানো হয়নি
        </p>
      ) : (
        <>
          <div className="mb-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-[11px] font-semibold text-destructive hover:text-destructive"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> সব মুছুন
            </Button>
          </div>
          <ScrollArea className="max-h-96 rounded-lg border">
            <ul className="divide-y">
              {broadcasts.map((n) => (
                <li key={n.id} className="p-3">
                  {editingId === n.id ? (
                    // ── এডিট মোড ──
                    <div className="grid gap-2.5">
                      <div className="grid gap-2.5 sm:grid-cols-[1fr_150px]">
                        <div>
                          <Label className="text-[11px]">শিরোনাম</Label>
                          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1 h-9 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[11px]">ধরন</Label>
                          <Select value={editType} onValueChange={setEditType}>
                            <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="promo">প্রোমো</SelectItem>
                              <SelectItem value="system">সিস্টেম</SelectItem>
                              <SelectItem value="stock">স্টক</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px]">বার্তা</Label>
                        <Textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={3} className="mt-1 text-xs" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="h-8 gap-1 text-xs font-semibold" onClick={saveEdit}>
                          <Check className="h-3.5 w-3.5" /> সেভ করুন
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" /> বাতিল
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // ── ভিউ মোড ──
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md', BROADCAST_TYPE_BADGE[n.type] ?? 'bg-muted text-muted-foreground')}>
                        <BellRing className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="min-w-0 truncate text-xs font-semibold">{n.title}</span>
                          <Badge variant="secondary" className={cn('shrink-0 text-[9px]', BROADCAST_TYPE_BADGE[n.type])}>
                            {NOTIF_TYPE_BN[n.type] ?? n.type}
                          </Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{n.message}</p>
                        <span className="mt-1 block text-[10px] text-muted-foreground/70">{formatBnDate(n.createdAt)}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => startEdit(n)}
                          aria-label="এডিট করুন" title="এডিট করুন"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => resend(n)}
                          aria-label="আবার পাঠান" title="আবার পাঠান — সব ট্যাবে পপআপ আবার দেখাবে"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(n)}
                          aria-label="ডিলিট করুন" title="ডিলিট করুন"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </>
      )}

      {/* একক ডিলিট কনফার্ম */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>নোটিফিকেশন ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `"${deleteTarget.title}"` : ''} — এই ব্রডকাস্ট সব ইউজারের বেল ও নোটিফিকেশন তালিকা থেকেও মুছে যাবে। এটি আর ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              ডিলিট করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* সব ডিলিট কনফার্ম */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>সব ব্রডকাস্ট মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              মোট {toBn(broadcasts.length)}টি ব্রডকাস্ট সব ইউজারের বেল থেকে মুছে যাবে। এটি আর ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearAll}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              সব মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ───────────────────────────── প্রোমো টুলস (ফাংশনাল কুইক-কন্ট্রোল) ─────────────────────────────

type PromoRow = {
  key: keyof SiteSettings;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PROMO_ROWS: PromoRow[] = [
  { key: 'announcement_enabled', title: 'স্লাইডিং ঘোষণা বার', desc: 'সাইটের একদম উপরের স্লাইডিং লেখা', icon: Megaphone },
  { key: 'popup_notice_enabled', title: 'নোটিশ পপআপ', desc: 'সাইট খুললেই যে নোটিশ ভেসে ওঠে', icon: BellRing },
  { key: 'popup_offer_enabled', title: 'অফার পপআপ', desc: 'প্রোমো ছবি/লেখা সহ অফার পপআপ', icon: Tag },
];

function PromoToolsCard({ onNavigate }: { onNavigate?: (s: Section) => void }) {
  const { toast } = useToast();
  const settings = useSettings();
  const announcements = useCollection('announcements');
  const activeAnnouncements = useMemo(() => announcements.filter((a) => a.enabled).length, [announcements]);

  const toggle = (key: keyof SiteSettings, label: string, on: boolean) => {
    saveSettings({ [key]: on ? '1' : '0' } as Partial<SiteSettings>);
    toast({ title: `${label} ${on ? 'চালু' : 'বন্ধ'} হয়েছে`, description: on ? 'ওয়েবসাইটে সঙ্গে সঙ্গে দেখা যাবে' : 'ওয়েবসাইট থেকে সরে গেছে' });
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold">প্রোমো টুলস</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">এক ক্লিকে চালু/বন্ধ — ওয়েবসাইটে সাথে সাথে খাটে</p>

      <ul className="space-y-2">
        {PROMO_ROWS.map((row) => {
          const on = settings[row.key] === '1';
          const RowIcon = row.icon;
          return (
            <li key={row.key} className={cn('flex items-center gap-3 rounded-lg border p-3 transition-opacity', !on && 'opacity-60')}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
                <RowIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold">{row.title}</span>
                  {row.key === 'announcement_enabled' && (
                    <Badge variant="secondary" className="shrink-0 text-[9px]">{toBn(activeAnnouncements)}টি সক্রিয়</Badge>
                  )}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">{row.desc}</p>
              </div>
              <Switch
                checked={on}
                onCheckedChange={(v) => toggle(row.key, row.title, v)}
                aria-label={`${row.title} চালু/বন্ধ`}
              />
            </li>
          );
        })}
      </ul>

      {onNavigate && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-1.5 text-xs font-semibold sm:w-auto"
          onClick={() => onNavigate('content')}
        >
          <ImageIcon className="h-3.5 w-3.5" /> ঘোষণার লেখা ও পপআপের কনটেন্ট এডিট করুন
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ───────────────────────────── কুপন ওভারভিউ (ফাংশনাল) ─────────────────────────────

function couponValueLabel(type: string, value: number): string {
  if (type === 'percent') return `${toBn(value)}% ছাড়`;
  if (type === 'free_shipping') return 'ফ্রি ডেলিভারি';
  return `${formatBDT(value)} ছাড়`;
}

function CouponStatsCard({ onNavigate }: { onNavigate?: (s: Section) => void }) {
  const coupons = useCollection('coupons');

  const stats = useMemo(() => {
    const now = Date.now();
    const isActive = (c: typeof coupons[number]) => {
      if (c.active === false) return false;
      const startOk = !c.startAt || new Date(c.startAt).getTime() <= now;
      const endOk = !c.expiresAt || new Date(c.expiresAt).getTime() >= now;
      const limitOk = c.usageLimit == null || c.usedCount < c.usageLimit;
      return startOk && endOk && limitOk;
    };
    const active = coupons.filter(isActive);
    const usedTotal = coupons.reduce((s, c) => s + (c.usedCount || 0), 0);
    const expiringSoon = active
      .filter((c) => !!c.expiresAt && new Date(c.expiresAt as string).getTime() - now < 7 * 86400000)
      .sort((a, b) => new Date(a.expiresAt as string).getTime() - new Date(b.expiresAt as string).getTime())
      .slice(0, 3);
    return { total: coupons.length, active: active.length, usedTotal, expiringSoon };
  }, [coupons]);

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Ticket className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold">কুপন ও ডিসকাউন্ট</h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <div className="text-xl font-extrabold text-primary">{toBn(stats.total)}</div>
          <div className="text-[10px] text-muted-foreground">মোট কুপন</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <div className="text-xl font-extrabold text-emerald-600">{toBn(stats.active)}</div>
          <div className="text-[10px] text-muted-foreground">এখন সক্রিয়</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <div className="text-xl font-extrabold">{toBn(stats.usedTotal)}</div>
          <div className="text-[10px] text-muted-foreground">মোট ব্যবহার</div>
        </div>
      </div>

      {stats.expiringSoon.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
            <Clock className="h-3 w-3" /> শীঘ্রই শেষ হবে (৭ দিনের মধ্যে)
          </p>
          <ul className="space-y-1.5">
            {stats.expiringSoon.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-[11px]">
                <span className="shrink-0 font-mono font-bold text-primary">{c.code}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{couponValueLabel(c.type, c.value)}</span>
                <span className="shrink-0 text-amber-600">{c.expiresAt ? formatBnDate(c.expiresAt) : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onNavigate && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-1.5 text-xs font-semibold sm:w-auto"
          onClick={() => onNavigate('coupons')}
        >
          <Ticket className="h-3.5 w-3.5" /> কুপন তৈরি ও ম্যানেজ করুন
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ───────────────────────────── মূল সেকশন ─────────────────────────────

export function AdminMarketing({ onNavigate }: { onNavigate?: (s: Section) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">মার্কেটিং</h2>
        <p className="text-xs text-muted-foreground">ফ্ল্যাশ সেল, ব্রডকাস্ট নোটিফিকেশন ও প্রোমো টুলস — সব ওয়েবসাইটে সরাসরি খাটে; পাঠানো নোটিফিকেশন যেকোনো সময় এডিট/ডিলিট করা যায়</p>
      </div>
      <FlashSaleCard />
      <BroadcastCard />
      <BroadcastManager />
      <PromoToolsCard onNavigate={onNavigate} />
      <CouponStatsCard onNavigate={onNavigate} />
    </div>
  );
}

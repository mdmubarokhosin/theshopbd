'use client';

/**
 * অ্যাডমিন — কুপন / রিভিউ মডারেশন / সাবস্ক্রাইবার
 * ---------------------------------------------------------------------------
 * AdminCoupons    : কুপন CRUD (percent / fixed / free_shipping)
 * AdminReviews    : রিভিউ অনুমোদন-নাকচ-উত্তর-ডিলিট + রেটিং রিক্যালকুলেট
 * AdminSubscribers: নিউজলেটার তালিকা, ম্যানুয়াল যোগ, CSV এক্সপোর্ট
 */

import { useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Ticket, Star, Mail, Download, MessageSquareReply,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { db, uid } from '@/lib/db/core';
import { useCollection } from '@/lib/db/hooks';
import {
  productById, recalcProductRating, subscribeEmail, downloadCSV, logAudit, getCurrentUser,
} from '@/lib/db/services';
import type { Coupon, CouponType, Review } from '@/lib/db/types';
import { formatBDT, toBn, formatBnDate } from '@/lib/types';
import { cn } from '@/lib/utils';

function actorName(): string {
  return getCurrentUser()?.name || 'অ্যাডমিন';
}

function toLocalInput(iso?: string | null): string {
  return iso ? iso.slice(0, 16) : '';
}

// ═══════════════════════════ কুপন ═══════════════════════════

const COUPON_TYPE_BN: Record<CouponType, string> = {
  percent: 'পার্সেন্ট',
  fixed: 'ফিক্সড',
  free_shipping: 'ফ্রি শিপিং',
};

const COUPON_TYPE_COLOR: Record<CouponType, string> = {
  percent: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  fixed: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  free_shipping: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
};

type CouponForm = {
  code: string;
  type: CouponType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  startAt: string;
  expiresAt: string;
  usageLimit: string;
  perUserLimit: string;
  firstOrderOnly: boolean;
  active: boolean;
};

const EMPTY_COUPON: CouponForm = {
  code: '', type: 'percent', value: '', minOrder: '0', maxDiscount: '',
  startAt: '', expiresAt: '', usageLimit: '', perUserLimit: '',
  firstOrderOnly: false, active: true,
};

export function AdminCoupons() {
  const { toast } = useToast();
  const couponsRaw = useCollection('coupons');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(EMPTY_COUPON);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  const coupons = useMemo(
    () => [...couponsRaw].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [couponsRaw]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_COUPON);
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value || ''),
      minOrder: String(c.minOrder || 0),
      maxDiscount: c.maxDiscount ? String(c.maxDiscount) : '',
      startAt: toLocalInput(c.startAt),
      expiresAt: toLocalInput(c.expiresAt),
      usageLimit: c.usageLimit ? String(c.usageLimit) : '',
      perUserLimit: c.perUserLimit ? String(c.perUserLimit) : '',
      firstOrderOnly: c.firstOrderOnly,
      active: c.active,
    });
    setDialogOpen(true);
  };

  const save = () => {
    const code = form.code.trim().toUpperCase();
    if (!code) {
      toast({ title: 'কুপন কোড দিন', variant: 'destructive' });
      return;
    }
    if (form.type !== 'free_shipping' && (!form.value || Number(form.value) <= 0)) {
      toast({ title: 'ছাড়ের পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    if (form.type === 'percent' && Number(form.value) > 100) {
      toast({ title: 'পার্সেন্ট ১০০-এর বেশি হতে পারে না', variant: 'destructive' });
      return;
    }
    if (coupons.some((c) => c.code.toUpperCase() === code && c.id !== editing?.id)) {
      toast({ title: 'এই কোড আগেই আছে', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const coupon: Coupon = {
      id: editing?.id || uid('cpn_'),
      code,
      type: form.type,
      value: form.type === 'free_shipping' ? 0 : Number(form.value) || 0,
      minOrder: Number(form.minOrder) || 0,
      maxDiscount: form.type === 'percent' && form.maxDiscount ? Number(form.maxDiscount) : null,
      startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      usedCount: editing?.usedCount ?? 0,
      perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
      categoryIds: editing?.categoryIds ?? null,
      productIds: editing?.productIds ?? null,
      brandIds: editing?.brandIds ?? null,
      firstOrderOnly: form.firstOrderOnly,
      active: form.active,
      createdAt: editing?.createdAt || new Date().toISOString(),
    };
    db.put('coupons', coupon);
    logAudit({
      actor: actorName(),
      action: editing ? 'coupon.update' : 'coupon.create',
      entity: 'coupon', entityId: coupon.code,
      details: `${coupon.code} — ${COUPON_TYPE_BN[coupon.type]}`,
    });
    setSaving(false);
    setDialogOpen(false);
    toast({ title: editing ? 'কুপন আপডেট হয়েছে' : 'কুপন তৈরি হয়েছে', description: coupon.code });
  };

  const toggleActive = (c: Coupon, active: boolean) => {
    db.put('coupons', { ...c, active });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    db.remove('coupons', deleteTarget.id);
    logAudit({ actor: actorName(), action: 'coupon.delete', entity: 'coupon', entityId: deleteTarget.code, details: deleteTarget.code });
    toast({ title: 'কুপন মুছে ফেলা হয়েছে', description: deleteTarget.code });
    setDeleteTarget(null);
  };

  const valueLabel = (c: Coupon) => {
    if (c.type === 'percent') return `${toBn(c.value)}% ছাড়`;
    if (c.type === 'fixed') return `${formatBDT(c.value)} ছাড়`;
    return 'ফ্রি ডেলিভারি';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">কুপন ম্যানেজমেন্ট</h2>
          <p className="text-xs text-muted-foreground">ডিসকাউন্ট ও ফ্রি শিপিং কুপন — চেকআউটে ব্যবহৃত হবে</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন কুপন
        </Button>
      </div>

      {coupons.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <Ticket className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো কুপন নেই</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => (
            <div key={c.id} className={cn('flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3', !c.active && 'opacity-60')}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-sm font-bold">{c.code}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', COUPON_TYPE_COLOR[c.type])}>
                    {COUPON_TYPE_BN[c.type]}
                  </span>
                  {c.firstOrderOnly && <Badge variant="outline" className="text-[10px]">প্রথম অর্ডার</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {valueLabel(c)}
                  {c.minOrder > 0 && ` • সর্বনিম্ন অর্ডার ${formatBDT(c.minOrder)}`}
                  {c.type === 'percent' && c.maxDiscount ? ` • সর্বোচ্চ ছাড় ${formatBDT(c.maxDiscount)}` : ''}
                  {` • ব্যবহৃত ${toBn(c.usedCount)}${c.usageLimit ? `/${toBn(c.usageLimit)}` : ''} বার`}
                  {c.expiresAt ? ` • শেষ ${formatBnDate(c.expiresAt)}` : ' • মেয়াদহীন'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch checked={c.active} onCheckedChange={(v) => toggleActive(c, v)} aria-label={`${c.code} সক্রিয় টগল`} />
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label="সম্পাদনা">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(c)}
                  aria-label="মুছুন"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* তৈরি/সম্পাদনা ডায়ালগ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'কুপন সম্পাদনা' : 'নতুন কুপন তৈরি'}</DialogTitle>
            <DialogDescription>কাস্টমাররা চেকআউটে কোড দিয়ে ছাড় পাবে</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>কুপন কোড <span className="text-destructive">*</span></Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="যেমন: EID20"
                  className="mt-1.5 font-mono"
                />
              </div>
              <div>
                <Label>ছাড়ের ধরন</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CouponType })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">% ছাড় (পার্সেন্ট)</SelectItem>
                    <SelectItem value="fixed">৳ ছাড় (ফিক্সড)</SelectItem>
                    <SelectItem value="free_shipping">ফ্রি শিপিং</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.type !== 'free_shipping' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>ছাড়ের পরিমাণ <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder={form.type === 'percent' ? '20' : '150'}
                    className="mt-1.5"
                  />
                </div>
                {form.type === 'percent' && (
                  <div>
                    <Label>সর্বোচ্চ ছাড় (৳, ঐচ্ছিক)</Label>
                    <Input
                      type="number"
                      value={form.maxDiscount}
                      onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                      placeholder="500"
                      className="mt-1.5"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>সর্বনিম্ন অর্ডার (৳)</Label>
                <Input
                  type="number"
                  value={form.minOrder}
                  onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>মোট ব্যবহার সীমা (ঐচ্ছিক)</Label>
                <Input
                  type="number"
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                  placeholder="100"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>প্রতি ইউজার সীমা (ঐচ্ছিক)</Label>
                <Input
                  type="number"
                  value={form.perUserLimit}
                  onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                  placeholder="1"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>প্রথম অর্ডার কুপন</Label>
                <label className="mt-1.5 flex h-9 cursor-pointer items-center gap-2 text-sm">
                  <Switch
                    checked={form.firstOrderOnly}
                    onCheckedChange={(v) => setForm({ ...form, firstOrderOnly: v })}
                    aria-label="প্রথম অর্ডার কুপন টগল"
                  />
                  {form.firstOrderOnly ? 'শুধু প্রথম অর্ডারে' : 'সবার জন্য'}
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>শুরুর সময় (ঐচ্ছিক)</Label>
                <Input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>মেয়াদ শেষ (ঐচ্ছিক)</Label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              নির্দিষ্ট ক্যাটাগরি/পণ্য/ব্র্যান্ডে সীমাবদ্ধ করার সুবিধা — ভবিষ্যতে আসছে। এখন কুপন সব পণ্যে প্রযোজ্য হবে।
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="text-sm font-semibold">সক্রিয়</div>
                <div className="text-xs text-muted-foreground">বন্ধ করলে চেকআউটে কাজ করবে না</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} aria-label="কুপন সক্রিয় টগল" />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> সেভ হচ্ছে...</> : editing ? 'আপডেট করুন' : 'তৈরি করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ডিলিট কনফার্ম */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>কুপনটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.code} স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════ রিভিউ মডারেশন ═══════════════════════════

const REVIEW_STATUS_BN: Record<Review['status'], string> = {
  PENDING: 'অপেক্ষমাণ',
  APPROVED: 'অনুমোদিত',
  REJECTED: 'নাকচ',
};

const REVIEW_STATUS_COLOR: Record<Review['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

type ReviewFilter = 'all' | Review['status'];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`রেটিং ${toBn(rating)} এর মধ্যে ৫`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn('h-3 w-3', i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </span>
  );
}

export function AdminReviews() {
  const { toast } = useToast();
  const reviewsRaw = useCollection('reviews');

  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  const reviews = useMemo(
    () => [...reviewsRaw].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [reviewsRaw]
  );

  const pendingCount = reviews.filter((r) => r.status === 'PENDING').length;

  const filtered = useMemo(
    () => (filter === 'all' ? reviews : reviews.filter((r) => r.status === filter)),
    [reviews, filter]
  );

  const setStatus = (r: Review, status: Review['status']) => {
    db.put('reviews', { ...r, status });
    recalcProductRating(r.productId);
    logAudit({
      actor: actorName(),
      action: status === 'APPROVED' ? 'review.approve' : 'review.reject',
      entity: 'review', entityId: r.id, details: `${r.name} → ${REVIEW_STATUS_BN[status]}`,
    });
    toast({
      title: status === 'APPROVED' ? 'রিভিউ অনুমোদিত হয়েছে' : 'রিভিউ নাকচ করা হয়েছে',
      description: `${r.name} — পণ্য রেটিং আপডেট হয়েছে`,
    });
  };

  const saveReply = () => {
    if (!replyTarget) return;
    if (!replyText.trim()) {
      toast({ title: 'উত্তর লিখুন', variant: 'destructive' });
      return;
    }
    db.put('reviews', { ...replyTarget, adminReply: replyText.trim() });
    logAudit({ actor: actorName(), action: 'review.reply', entity: 'review', entityId: replyTarget.id, details: replyTarget.name });
    toast({ title: 'অ্যাডমিন উত্তর সেভ হয়েছে' });
    setReplyTarget(null);
    setReplyText('');
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    db.remove('reviews', deleteTarget.id);
    recalcProductRating(deleteTarget.productId);
    logAudit({ actor: actorName(), action: 'review.delete', entity: 'review', entityId: deleteTarget.id, details: deleteTarget.name });
    toast({ title: 'রিভিউ মুছে ফেলা হয়েছে' });
    setDeleteTarget(null);
  };

  const filterTabs: { key: ReviewFilter; label: string; badge?: number }[] = [
    { key: 'all', label: 'সব' },
    { key: 'PENDING', label: 'অপেক্ষমাণ', badge: pendingCount },
    { key: 'APPROVED', label: 'অনুমোদিত' },
    { key: 'REJECTED', label: 'বাতিল' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">রিভিউ মডারেশন</h2>
        <p className="text-xs text-muted-foreground">নতুন রিভিউ অনুমোদন করলে পণ্য পেজে দেখা যাবে</p>
      </div>

      {/* ফিল্টার */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              filter === t.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent'
            )}
          >
            {t.label}
            {t.badge ? (
              <span className={cn(
                'flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                filter === t.key ? 'bg-white/20 text-white' : 'bg-destructive text-white'
              )}>
                {toBn(t.badge)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <Star className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">এই ক্যাটাগরিতে কোনো রিভিউ নেই</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const product = productById(r.productId);
            return (
              <div key={r.id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold">{r.name}</span>
                  <Stars rating={r.rating} />
                  {r.verifiedPurchase && (
                    <Badge variant="outline" className="border-green-300 text-[10px] text-green-700 dark:text-green-400">
                      ভেরিফায়েড ক্রেতা
                    </Badge>
                  )}
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', REVIEW_STATUS_COLOR[r.status])}>
                    {REVIEW_STATUS_BN[r.status]}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatBnDate(r.createdAt)}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  পণ্য: {product ? (product.nameBn || product.name) : 'পণ্যটি আর নেই'}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.comment}</p>
                {r.adminReply && (
                  <div className="mt-2 rounded-lg bg-muted p-2 text-xs">
                    <span className="font-semibold text-foreground">অ্যাডমিনের উত্তর: </span>
                    {r.adminReply}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.status !== 'APPROVED' && (
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setStatus(r, 'APPROVED')}>
                      অনুমোদন
                    </Button>
                  )}
                  {r.status !== 'REJECTED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => setStatus(r, 'REJECTED')}
                    >
                      বাতিল
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => { setReplyTarget(r); setReplyText(r.adminReply || ''); }}
                  >
                    <MessageSquareReply className="h-3.5 w-3.5" /> উত্তর দিন
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> ডিলিট
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* উত্তর ডায়ালগ */}
      <Dialog open={!!replyTarget} onOpenChange={(o) => !o && setReplyTarget(null)}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>রিভিউতে উত্তর দিন</DialogTitle>
            <DialogDescription>
              {replyTarget?.name} — পণ্য পেজে অ্যাডমিন উত্তর দেখানো হবে
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            placeholder="কাস্টমারকে ধন্যবাদ বা সমস্যার সমাধান জানান..."
          />
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setReplyTarget(null)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={saveReply}>উত্তর সেভ করুন</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ডিলিট কনফার্ম */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>রিভিউটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name} এর রিভিউ স্থায়ীভাবে মুছে যাবে ও পণ্য রেটিং আপডেট হবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════ সাবস্ক্রাইবার ═══════════════════════════

export function AdminSubscribers() {
  const { toast } = useToast();
  const subscribersRaw = useCollection('subscribers');
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const subscribers = useMemo(
    () => [...subscribersRaw].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [subscribersRaw]
  );

  const addManual = () => {
    const email = newEmail.trim();
    if (!email) {
      toast({ title: 'ইমেইল দিন', variant: 'destructive' });
      return;
    }
    setAdding(true);
    const res = subscribeEmail(email);
    setAdding(false);
    if (res.ok) {
      toast({ title: 'সাবস্ক্রাইবার যোগ হয়েছে', description: email });
      setNewEmail('');
    } else {
      toast({ title: 'যোগ করা যায়নি', description: res.error, variant: 'destructive' });
    }
  };

  const removeOne = (id: string, email: string) => {
    db.remove('subscribers', id);
    toast({ title: 'সাবস্ক্রাইবার মুছে ফেলা হয়েছে', description: email });
  };

  const exportCsv = () => {
    if (!subscribers.length) {
      toast({ title: 'এক্সপোর্ট করার মতো সাবস্ক্রাইবার নেই', variant: 'destructive' });
      return;
    }
    downloadCSV(
      `subscribers-${new Date().toISOString().slice(0, 10)}.csv`,
      subscribers.map((s) => ({ email: s.email, date: (s.createdAt ?? '').slice(0, 10) })),
      { email: 'ইমেইল', date: 'সাবস্ক্রাইবের তারিখ' }
    );
    toast({ title: 'CSV ডাউনলোড হয়েছে' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">নিউজলেটার সাবস্ক্রাইবার</h2>
          <p className="text-xs text-muted-foreground">প্রোমো ও অফারের ইমেইল তালিকা</p>
        </div>
        <Badge variant="secondary" className="text-xs">মোট: {toBn(subscribers.length)} জন</Badge>
      </div>

      {/* ম্যানুয়াল যোগ + এক্সপোর্ট */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row">
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addManual()}
          placeholder="name@example.com"
          className="flex-1"
        />
        <Button onClick={addManual} disabled={adding} className="gap-1.5 font-semibold">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} যোগ করুন
        </Button>
        <Button variant="outline" onClick={exportCsv} className="gap-1.5">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {subscribers.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <Mail className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো সাবস্ক্রাইবার নেই</p>
        </div>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {subscribers.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.email}</div>
                <div className="text-xs text-muted-foreground">{formatBnDate(s.createdAt)}</div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => removeOne(s.id, s.email)}
                aria-label={`${s.email} মুছুন`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

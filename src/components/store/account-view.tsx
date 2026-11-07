'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, Package, User, MapPin, Bell, LifeBuoy, Star, ShieldCheck,
  LogOut, Plus, Pencil, Trash2, Loader2, Printer, Repeat2, XCircle, RotateCcw,
  ChevronDown, CreditCard, Truck, Tag, Settings, Archive, ShoppingBag, Heart,
  Mail, Phone, Camera, Send, MessageSquarePlus, AlertTriangle, Sparkles, Gift,
  Copy, Users, Wallet, Info, UserX, Clock, CheckCircle2, XCircle as XCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { useCurrentUser, notifyAuthChanged } from '@/lib/db/hooks';
import { db } from '@/lib/db/core';
import { fileToDataUrl } from '@/lib/db/image-tools';
import { GeoAddressFields } from '@/components/store/geo-address-fields';
import {
  ordersOfUser, notificationsFor, unreadNotificationCount, markNotificationsRead,
  createTicket, ticketsOfUser, replyTicket, closeTicket, rateTicket,
  reorder, productById,
  latestDeletionRequest, requestAccountDeletion, cancelDeletionRequest,
} from '@/lib/db/services';
import {
  updateProfile, changePassword, logout, saveAddress, deleteAddress, userAddresses,
} from '@/lib/db/auth';
import {
  loyaltyBalanceOf, loyaltyEarnForAmount, ensureRefCode, referralBalanceOf,
  requestReferralWithdraw,
} from '@/lib/db/growth';
import { isGithubConfigured, uploadDataUrlToGithub } from '@/lib/db/github';
import type { Address, Notification, SupportTicket } from '@/lib/db/types';
import {
  formatBDT, toBn, formatBnDate, ORDER_STATUS_BN, ORDER_STATUS_COLOR,
  type AccountTab,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { InvoicePrint, OrderTimeline, ReturnRequestDialog } from './order-views';

const PHONE_RE = /^01[3-9]\d{8}$/;

/** DB পরিবর্তনে রি-রেন্ডার ট্রিগার */
function useDbTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => db.subscribe(() => setTick((t) => t + 1)), []);
  return tick;
}

const TAB_META: { key: AccountTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { key: 'orders', label: 'আমার অর্ডার', icon: Package },
  { key: 'loyalty', label: 'লয়ালটি পয়েন্ট', icon: Sparkles },
  { key: 'referral', label: 'রেফারেল আয়', icon: Gift },
  { key: 'profile', label: 'প্রোফাইল', icon: User },
  { key: 'addresses', label: 'ঠিকানা', icon: MapPin },
  { key: 'notifications', label: 'নোটিফিকেশন', icon: Bell },
  { key: 'tickets', label: 'সাপোর্ট টিকেট', icon: LifeBuoy },
  { key: 'reviews', label: 'রিভিউ', icon: Star },
  { key: 'security', label: 'নিরাপত্তা', icon: ShieldCheck },
];

const NOTIF_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  order: Package,
  payment: CreditCard,
  shipment: Truck,
  promo: Tag,
  system: Settings,
  stock: Archive,
};

const NOTIF_TYPE_BN: Record<string, string> = {
  order: 'অর্ডার',
  payment: 'পেমেন্ট',
  shipment: 'শিপমেন্ট',
  promo: 'অফার',
  system: 'সিস্টেম',
  stock: 'স্টক',
};

// ═══════════════════════ ড্যাশবোর্ড ═══════════════════════

function DashboardTab({ userId }: { userId: string }) {
  const navigate = useStore((s) => s.navigate);
  const wishlist = useStore((s) => s.wishlist);
  const tick = useDbTick();

  const orders = useMemo(() => ordersOfUser(userId), [userId, tick]);
  const activeOrders = orders.filter((o) =>
    ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.status)
  );
  const delivered = orders.filter((o) => o.status === 'DELIVERED');
  const unread = useMemo(() => unreadNotificationCount(userId), [userId, tick]);
  const notifs = useMemo(() => notificationsFor(userId).slice(0, 3), [userId, tick]);

  const stats = [
    { label: 'মোট অর্ডার', value: orders.length, icon: Package, onClick: () => navigate({ name: 'account', tab: 'orders' }) },
    { label: 'চলমান অর্ডার', value: activeOrders.length, icon: Truck, onClick: () => navigate({ name: 'account', tab: 'orders' }) },
    { label: 'সম্পন্ন ডেলিভারি', value: delivered.length, icon: ShoppingBag, onClick: () => navigate({ name: 'account', tab: 'orders' }) },
    { label: 'উইশলিস্ট', value: wishlist.length, icon: Heart, onClick: () => navigate({ name: 'wishlist' }) },
    { label: 'অপঠিত নোটিফিকেশন', value: unread, icon: Bell, onClick: () => navigate({ name: 'account', tab: 'notifications' }) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <s.icon className="h-5 w-5 text-primary" />
            <div className="mt-2 text-2xl font-extrabold">{toBn(s.value)}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </button>
        ))}
      </div>

      {/* সাম্প্রতিক অর্ডার */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Package className="h-4 w-4 text-primary" /> সাম্প্রতিক অর্ডার
          </h3>
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => navigate({ name: 'account', tab: 'orders' })}
          >
            সব দেখুন
          </button>
        </div>
        {orders.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            এখনো কোনো অর্ডার নেই।{' '}
            <button className="font-medium text-primary hover:underline" onClick={() => navigate({ name: 'shop' })}>
              কেনাকাটা শুরু করুন
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 3).map((o) => (
              <button
                key={o.id}
                onClick={() => navigate({ name: 'account', tab: 'orders' })}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent/40"
              >
                <div>
                  <div className="text-sm font-bold text-primary">{o.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">{formatBnDate(o.createdAt)} · {toBn(o.items.length)} টি পণ্য</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{formatBDT(o.total)}</span>
                  <Badge className={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_BN[o.status] || o.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* সাম্প্রতিক নোটিফিকেশন */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Bell className="h-4 w-4 text-primary" /> সাম্প্রতিক নোটিফিকেশন
          </h3>
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => navigate({ name: 'account', tab: 'notifications' })}
          >
            সব দেখুন
          </button>
        </div>
        {notifs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">কোনো নোটিফিকেশন নেই</p>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => {
              const Icon = NOTIF_ICON[n.type] ?? Bell;
              return (
                <div key={n.id} className={cn('flex items-start gap-3 rounded-lg border p-3', !n.read && 'bg-primary/5')}>
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', n.read ? 'text-muted-foreground' : 'text-primary')} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════ অর্ডারস ═══════════════════════

function OrdersTab({ userId }: { userId: string }) {
  const navigate = useStore((s) => s.navigate);
  const tick = useDbTick();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reqType, setReqType] = useState<'return' | 'cancel' | 'replacement' | null>(null);

  const orders = useMemo(() => ordersOfUser(userId), [userId, tick]);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed py-14 text-center">
        <Package className="mb-3 h-12 w-12 text-muted-foreground/25" />
        <p className="font-semibold">কোনো অর্ডার নেই</p>
        <p className="mt-1 text-sm text-muted-foreground">আপনার প্রথম অর্ডারটি করে ফেলুন!</p>
        <Button className="mt-5" onClick={() => navigate({ name: 'shop' })}>কেনাকাটা শুরু করুন</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const open = expanded === o.id;
        const cancellable = ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(o.status);
        const returnable = ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status);
        return (
          <div key={o.id} className="rounded-xl border bg-card">
            <button
              onClick={() => setExpanded(open ? null : o.id)}
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
              aria-expanded={open}
            >
              <div>
                <div className="text-sm font-bold text-primary">{o.orderNumber}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBnDate(o.createdAt)} · {toBn(o.items.length)} টি পণ্য · {o.paymentMethodName}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">{formatBDT(o.total)}</span>
                <Badge className={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_BN[o.status] || o.status}</Badge>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
              </div>
            </button>

            {open && (
              <div className="border-t p-4">
                {/* আইটেম */}
                <div className="space-y-2.5">
                  {o.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                          {it.image ? (
                            <img src={it.image} alt={it.productName} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{it.productName}</div>
                          {it.variantName && <div className="text-[11px] text-muted-foreground">{it.variantName}</div>}
                          <div className="text-xs text-muted-foreground">{toBn(it.quantity)} × {formatBDT(it.price)}</div>
                        </div>
                      </div>
                      <div className="font-bold">{formatBDT(it.price * it.quantity)}</div>
                    </div>
                  ))}
                </div>

                <Separator className="my-3" />

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-1 sm:col-span-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {o.customerName} · {o.phone} — {o.address}, {[o.area, o.city, o.district].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <div><span className="text-muted-foreground">পেমেন্ট:</span> {o.paymentMethodName}</div>
                  <div><span className="text-muted-foreground">স্ট্যাটাস:</span> {ORDER_STATUS_BN[o.status] || o.status}</div>
                </div>

                {/* টাইমলাইন */}
                <div className="mt-4">
                  <OrderTimeline order={o} />
                </div>

                {/* অ্যাকশন */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="mr-1.5 h-4 w-4" /> ইনভয়েস প্রিন্ট
                  </Button>
                  {cancellable && (
                    <Button variant="outline" size="sm" onClick={() => setReqType('cancel')}>
                      <XCircle className="mr-1.5 h-4 w-4 text-destructive" /> বাতিলের অনুরোধ
                    </Button>
                  )}
                  {returnable && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setReqType('return')}>
                        <RotateCcw className="mr-1.5 h-4 w-4 text-primary" /> রিটার্ন
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setReqType('replacement')}>
                        <Repeat2 className="mr-1.5 h-4 w-4 text-primary" /> রিপ্লেসমেন্ট
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const res = reorder(o.orderNumber);
                      if (res.ok) {
                        toast({ title: 'পণ্যগুলো কার্টে যোগ হয়েছে' });
                        navigate({ name: 'cart' });
                      } else {
                        toast({ title: 'রিঅর্ডার সম্ভব হয়নি', description: res.error, variant: 'destructive' });
                      }
                    }}
                  >
                    <Repeat2 className="mr-1.5 h-4 w-4 text-primary" /> আবার অর্ডার
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'track-order', orderNumber: o.orderNumber })}>
                    ট্র্যাক পেজে দেখুন
                  </Button>
                </div>

                {/* লুকানো ইনভয়েস (প্রিন্ট) */}
                <InvoicePrint order={o} />
              </div>
            )}
          </div>
        );
      })}

      {reqType && expanded && (() => {
        const o = orders.find((x) => x.id === expanded);
        if (!o) return null;
        return (
          <ReturnRequestDialog
            order={o}
            type={reqType}
            open={!!reqType}
            onOpenChange={(v) => { if (!v) setReqType(null); }}
          />
        );
      })()}
    </div>
  );
}

// ═══════════════════════ প্রোফাইল ═══════════════════════

function ProfileTab({ userId, name, email, phone, avatar, dob, newsletter }: {
  userId: string; name: string; email: string; phone: string; avatar: string | null; dob: string; newsletter: boolean;
}) {
  const [, force] = useState(0);
  const [form, setForm] = useState({ name, email, phone, dateOfBirth: dob });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // প্রোফাইল আপডেটে key রি-মাউন্টের মাধ্যমে ফর্ম রি-ইনিট হয় (effect প্রয়োজন নেই)

  const pickAvatar = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file, 300, 0.85);
      // GitHub হোস্টিং চালু থাকলে ছবি রিপোতে উঠে jsDelivr URL হিসেবে সেভ হয়
      let avatarValue = dataUrl;
      if (isGithubConfigured()) {
        const up = await uploadDataUrlToGithub(dataUrl, file.name, 'avatars');
        if (up.ok && up.url) avatarValue = up.url;
      }
      const res = await updateProfile(userId, { avatar: avatarValue });
      if (res.ok) {
        notifyAuthChanged();
        toast({ title: 'প্রোফাইল ছবি আপডেট হয়েছে' });
      } else {
        toast({ title: res.error || 'আপডেট ব্যর্থ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'ছবিটি পড়া যায়নি', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast({ title: 'নাম লিখুন', variant: 'destructive' });
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) {
      return toast({ title: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন', variant: 'destructive' });
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return toast({ title: 'সঠিক ইমেইল দিন', variant: 'destructive' });
    }
    setSaving(true);
    const res = await updateProfile(userId, {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      dateOfBirth: form.dateOfBirth.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      notifyAuthChanged();
      force((n) => n + 1);
      toast({ title: 'প্রোফাইল সেভ হয়েছে' });
    } else {
      toast({ title: 'সেভ হয়নি', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-xl space-y-5">
      {/* অ্যাভাটার */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-20 w-20 border">
            {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
            <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
              {name.charAt(0) || 'গ'}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90"
            aria-label="ছবি পরিবর্তন করুন"
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickAvatar(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <div className="font-bold">{name}</div>
          <div className="text-sm text-muted-foreground">{email || phone || '—'}</div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pf-name">নাম</Label>
          <Input id="pf-name" className="mt-1.5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="pf-phone">মোবাইল</Label>
          <Input
            id="pf-phone"
            className="mt-1.5"
            inputMode="numeric"
            maxLength={11}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
            placeholder="01XXXXXXXXX"
          />
        </div>
        <div>
          <Label htmlFor="pf-email">ইমেইল</Label>
          <Input id="pf-email" className="mt-1.5" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="pf-dob">জন্ম তারিখ</Label>
          <Input id="pf-dob" className="mt-1.5" type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-card p-4">
        <div>
          <div className="text-sm font-semibold">নিউজলেটার সাবস্ক্রিপশন</div>
          <div className="text-xs text-muted-foreground">অফার, নতুন পণ্য ও কুপনের আপডেট পান</div>
        </div>
        <Switch
          checked={newsletter}
          onCheckedChange={(v) => {
            void updateProfile(userId, { newsletterSubscribed: v }).then((res) => {
              if (res.ok) {
                notifyAuthChanged();
                force((n) => n + 1);
                toast({ title: v ? 'নিউজলেটার চালু হয়েছে' : 'নিউজলেটার বন্ধ হয়েছে' });
              }
            });
          }}
          aria-label="নিউজলেটার সাবস্ক্রিপশন"
        />
      </div>

      <Button onClick={save} disabled={saving} className="font-semibold">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} পরিবর্তন সেভ করুন
      </Button>
    </div>
  );
}

// ═══════════════════════ ঠিকানা ═══════════════════════

const EMPTY_ADDR = { label: 'বাসা', name: '', phone: '', division: '', district: '', city: '', area: '', fullAddress: '' };

function AddressesTab({ userId }: { userId: string }) {
  const tick = useDbTick();
  const [form, setForm] = useState<typeof EMPTY_ADDR & { isDefaultShipping: boolean }>({ ...EMPTY_ADDR, isDefaultShipping: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);

  const addresses = useMemo(() => userAddresses(userId), [userId, tick]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_ADDR, isDefaultShipping: false });
    setDialogOpen(true);
  };

  const openEdit = (a: Address) => {
    setEditingId(a.id);
    setForm({
      label: a.label, name: a.name, phone: a.phone, division: a.division || '', district: a.district,
      city: a.city, area: a.area, fullAddress: a.fullAddress, isDefaultShipping: a.isDefaultShipping,
    });
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) return toast({ title: 'প্রাপকের নাম লিখুন', variant: 'destructive' });
    if (!PHONE_RE.test(form.phone.trim())) return toast({ title: 'সঠিক মোবাইল নম্বর দিন', variant: 'destructive' });
    if (!form.district.trim() || !form.city.trim() || !form.fullAddress.trim()) {
      return toast({ title: 'জেলা, শহর ও সম্পূর্ণ ঠিকানা লিখুন', variant: 'destructive' });
    }
    // এডিট হলে পুরোনোটি মুছে নতুন করে সেভ
    if (editingId) deleteAddress(editingId, userId);
    const saved = saveAddress({
      userId,
      label: form.label.trim() || 'ঠিকানা',
      name: form.name.trim(),
      phone: form.phone.trim(),
      division: form.division.trim(),
      district: form.district.trim(),
      city: form.city.trim(),
      area: form.area.trim(),
      fullAddress: form.fullAddress.trim(),
      isDefaultShipping: form.isDefaultShipping,
      isDefaultBilling: form.isDefaultShipping,
    });
    setDialogOpen(false);
    toast({ title: editingId ? 'ঠিকানা আপডেট হয়েছে' : 'ঠিকানা যোগ হয়েছে', description: saved.label });
  };

  const setDefault = (a: Address) => {
    const others = db.collection('addresses').filter((x) => x.userId !== userId);
    const mine = db.collection('addresses')
      .filter((x) => x.userId === userId)
      .map((x) => ({ ...x, isDefaultShipping: x.id === a.id, isDefaultBilling: x.id === a.id }));
    db.setCollection('addresses', [...others, ...mine]);
    toast({ title: 'ডিফল্ট শিপিং ঠিকানা সেট হয়েছে' });
  };

  const doDelete = (a: Address) => {
    deleteAddress(a.id, userId);
    setDeleteTarget(null);
    toast({ title: 'ঠিকানা মুছে ফেলা হয়েছে' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">সেভ করা ঠিকানা ({toBn(addresses.length)})</h3>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> নতুন ঠিকানা
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed py-10 text-center">
          <MapPin className="mb-2 h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm font-semibold">কোনো ঠিকানা সেভ করা নেই</p>
          <p className="mt-1 text-xs text-muted-foreground">চেকআউট দ্রুত করতে ঠিকানা সেভ করে রাখুন</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold">
                  {a.label}
                  {a.isDefaultShipping && (
                    <Badge className="bg-primary text-[10px] text-primary-foreground hover:bg-primary">ডিফল্ট শিপিং</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!a.isDefaultShipping && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={() => setDefault(a)}>
                      ডিফল্ট করুন
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)} aria-label="এডিট করুন">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(a)} aria-label="মুছুন">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-sm font-medium">{a.name}</div>
              <div className="text-xs text-muted-foreground">{a.phone}</div>
              <div className="mt-1 break-words text-sm text-muted-foreground">
                {a.fullAddress}, {a.area ? `${a.area}, ` : ''}{a.city}, {a.district}{a.division ? `, ${a.division}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* যোগ/এডিট ডায়ালগ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'ঠিকানা এডিট করুন' : 'নতুন ঠিকানা'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ad-label">লেবেল</Label>
              <Input id="ad-label" className="mt-1.5" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="বাসা / অফিস" />
            </div>
            <div>
              <Label htmlFor="ad-name">প্রাপকের নাম</Label>
              <Input id="ad-name" className="mt-1.5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="ad-phone">মোবাইল</Label>
              <Input id="ad-phone" className="mt-1.5" inputMode="numeric" maxLength={11} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} placeholder="01XXXXXXXXX" />
            </div>
            <div className="sm:col-span-2">
              <GeoAddressFields
                value={{ division: form.division, district: form.district, city: form.city, area: form.area }}
                onChange={(v) => setForm((f) => ({ ...f, division: v.division, district: v.district, city: v.city, area: v.area }))}
                optionalUnion
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ad-full">সম্পূর্ণ ঠিকানা</Label>
              <Textarea id="ad-full" className="mt-1.5" rows={2} value={form.fullAddress} onChange={(e) => setForm((f) => ({ ...f, fullAddress: e.target.value }))} placeholder="বাসা নম্বর, রোড, গলি, ল্যান্ডমার্ক..." />
            </div>
            <label className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                checked={form.isDefaultShipping}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isDefaultShipping: v === true }))}
                aria-label="ডিফল্ট শিপিং ঠিকানা"
              />
              <span className="text-sm">ডিফল্ট শিপিং ঠিকানা হিসেবে সেট করুন</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={submit} className="font-semibold">সেভ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ডিলিট কনফার্মেশন */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ঠিকানা মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.label} — {deleteTarget?.fullAddress} মুছে ফেলা হবে। এটি ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, রাখুন</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => deleteTarget && doDelete(deleteTarget)}>
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════ নোটিফিকেশন ═══════════════════════

function NotificationsTab({ userId }: { userId: string }) {
  const tick = useDbTick();
  const navigate = useStore((s) => s.navigate);
  const notifs = useMemo(() => notificationsFor(userId), [userId, tick]);
  const unread = notifs.filter((n) => !n.read).length;

  const openNotif = (n: Notification) => {
    if (!n.read) {
      markNotificationsRead([n.id]);
    }
    if (n.type === 'order' || n.type === 'shipment' || n.type === 'payment') {
      navigate({ name: 'account', tab: 'orders' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">
          নোটিফিকেশন {unread > 0 && <span className="text-primary">({toBn(unread)} টি অপঠিত)</span>}
        </h3>
        {unread > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => { markNotificationsRead(); toast({ title: 'সব পড়া হয়েছে' }); }}
          >
            সব পড়া হয়েছে
          </Button>
        )}
      </div>

      {notifs.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
          <Bell className="mb-2 h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm font-semibold">কোনো নোটিফিকেশন নেই</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => {
            const Icon = NOTIF_ICON[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                onClick={() => openNotif(n)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-accent/40',
                  !n.read && 'border-primary/30 bg-primary/5'
                )}
              >
                <span className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  n.read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                )}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{n.title}</span>
                    <Badge variant="outline" className="text-[10px]">{NOTIF_TYPE_BN[n.type] || n.type}</Badge>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">{formatBnDate(n.createdAt)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ টিকেট ═══════════════════════

const TICKET_STATUS_BN: Record<string, string> = { OPEN: 'খোলা', ANSWERED: 'উত্তর দেওয়া হয়েছে', CLOSED: 'বন্ধ' };
const TICKET_STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  ANSWERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  CLOSED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
};

function TicketsTab({ userId, name, email, phone }: { userId: string; name: string; email: string; phone: string }) {
  const tick = useDbTick();
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ntSubject, setNtSubject] = useState('');
  const [ntOrder, setNtOrder] = useState('');
  const [ntMessage, setNtMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  const tickets = useMemo(() => ticketsOfUser(userId), [userId, tick]);
  const openTicket = tickets.find((t) => t.id === openId) ?? null;

  const submitTicket = () => {
    if (!ntSubject.trim()) return toast({ title: 'বিষয় লিখুন', variant: 'destructive' });
    if (!ntMessage.trim()) return toast({ title: 'মেসেজ লিখুন', variant: 'destructive' });
    setBusy(true);
    const t = createTicket({
      name: name || 'কাস্টমার',
      email: email || undefined,
      phone: phone || undefined,
      subject: ntSubject.trim(),
      orderNumber: ntOrder.trim() || undefined,
      message: ntMessage.trim(),
      userId,
    });
    setBusy(false);
    setShowForm(false);
    setNtSubject(''); setNtOrder(''); setNtMessage('');
    setOpenId(t.id);
    toast({ title: 'টিকেট তৈরি হয়েছে', description: `টিকেট নম্বর: ${t.ticketNumber}` });
  };

  const sendReply = () => {
    if (!openTicket) return;
    if (!replyText.trim()) return toast({ title: 'মেসেজ লিখুন', variant: 'destructive' });
    const res = replyTicket(openTicket.id, 'customer', replyText.trim());
    if (res.ok) {
      setReplyText('');
    } else {
      toast({ title: 'পাঠানো যায়নি', description: res.error, variant: 'destructive' });
    }
  };

  // খোলা টিকেটের কনভার্সেশন
  if (openTicket) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setOpenId(null); }}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← সব টিকেট
        </button>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold">{openTicket.subject}</div>
              <div className="text-xs text-muted-foreground">
                {openTicket.ticketNumber}
                {openTicket.orderNumber ? ` · অর্ডার: ${openTicket.orderNumber}` : ''} · {formatBnDate(openTicket.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={TICKET_STATUS_COLOR[openTicket.status]}>{TICKET_STATUS_BN[openTicket.status]}</Badge>
              {openTicket.status !== 'CLOSED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { closeTicket(openTicket.id); toast({ title: 'টিকেট বন্ধ করা হয়েছে' }); }}
                >
                  টিকেট বন্ধ করুন
                </Button>
              )}
            </div>
          </div>

          {/* কনভার্সেশন */}
          <div className="mt-4 max-h-96 space-y-3 overflow-y-auto scrollbar-thin rounded-lg bg-muted/30 p-3">
            {(Array.isArray(openTicket.messages) ? openTicket.messages : []).map((m, i) => (
              <div key={i} className={cn('flex', m.from === 'customer' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                    m.from === 'customer'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm border bg-background'
                  )}
                >
                  <div className="mb-0.5 text-[10px] font-semibold opacity-70">
                    {m.from === 'customer' ? 'আপনি' : 'সাপোর্ট টিম'} · {formatBnDate(m.at)}
                  </div>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* রিপ্লাই */}
          {openTicket.status !== 'CLOSED' ? (
            <div className="mt-3 flex gap-2">
              <Textarea
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="উত্তর লিখুন..."
                className="min-h-0 flex-1"
              />
              <Button onClick={sendReply} aria-label="পাঠান">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-center text-xs text-muted-foreground">এই টিকেট বন্ধ করা হয়েছে</p>
          )}

          {/* রেটিং */}
          {openTicket.status === 'CLOSED' && !openTicket.rating && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">সাপোর্ট রেটিং:</span>
              {[1, 2, 3, 4, 5].map((r) => (
                <button key={r} onClick={() => { rateTicket(openTicket.id, r); toast({ title: 'ধন্যবাদ!' }); }} aria-label={`${r} স্টার`}>
                  <Star className={cn('h-5 w-5', r <= 3 ? 'text-amber-400' : 'text-muted-foreground/40')} fill={r <= 3 ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">সাপোর্ট টিকেট ({toBn(tickets.length)})</h3>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" /> নতুন টিকেট
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tk-subject">বিষয়</Label>
              <Input id="tk-subject" className="mt-1.5" value={ntSubject} onChange={(e) => setNtSubject(e.target.value)} placeholder="সমস্যার সংক্ষিপ্ত বিবরণ" />
            </div>
            <div>
              <Label htmlFor="tk-order">অর্ডার নম্বর (ঐচ্ছিক)</Label>
              <Input id="tk-order" className="mt-1.5" value={ntOrder} onChange={(e) => setNtOrder(e.target.value)} placeholder="TS-XXXXXX-XXXX" />
            </div>
          </div>
          <div>
            <Label htmlFor="tk-message">মেসেজ</Label>
            <Textarea id="tk-message" className="mt-1.5" rows={4} value={ntMessage} onChange={(e) => setNtMessage(e.target.value)} placeholder="আপনার সমস্যাটি বিস্তারিত লিখুন..." />
          </div>
          <Button onClick={submitTicket} disabled={busy} className="font-semibold">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} টিকেট তৈরি করুন
          </Button>
        </div>
      )}

      {tickets.length === 0 && !showForm ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
          <LifeBuoy className="mb-2 h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm font-semibold">কোনো টিকেট নেই</p>
          <p className="mt-1 text-xs text-muted-foreground">যেকোনো সমস্যায় নতুন টিকেট খুলুন</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t: SupportTicket) => (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40"
            >
              <div>
                <div className="text-sm font-semibold">{t.subject}</div>
                <div className="text-xs text-muted-foreground">
                  {t.ticketNumber} · {toBn((Array.isArray(t.messages) ? t.messages : []).length)} টি মেসেজ · {formatBnDate(t.createdAt)}
                </div>
              </div>
              <Badge className={TICKET_STATUS_COLOR[t.status]}>{TICKET_STATUS_BN[t.status]}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ রিভিউ ═══════════════════════

const REVIEW_STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: 'অনুমোদিত', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  PENDING: { label: 'পর্যালোচনাধীন', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  REJECTED: { label: 'বাতিল', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
};

function ReviewsTab({ userId }: { userId: string }) {
  const navigate = useStore((s) => s.navigate);
  const tick = useDbTick();
  const reviews = useMemo(
    () =>
      db.collection('reviews')
        .filter((r) => r.userId === userId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [userId, tick]
  );

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
        <Star className="mb-2 h-10 w-10 text-muted-foreground/25" />
        <p className="text-sm font-semibold">আপনি এখনো কোনো রিভিউ দেননি</p>
        <p className="mt-1 text-xs text-muted-foreground">পণ্য পেজ থেকে রিভিউ দিন</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => {
        const p = productById(r.productId);
        const st = REVIEW_STATUS[r.status] ?? REVIEW_STATUS.PENDING;
        return (
          <div key={r.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                className="text-sm font-semibold text-primary hover:underline"
                onClick={() => p && navigate({ name: 'product', slug: p.slug })}
              >
                {p ? (p.nameBn || p.name) : 'পণ্যটি আর নেই'}
              </button>
              <Badge className={st.cls}>{st.label}</Badge>
            </div>
            <div className="mt-1.5 flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn('h-3.5 w-3.5', i < Math.round(r.rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
                />
              ))}
              <span className="ml-2 text-xs text-muted-foreground">{formatBnDate(r.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
            {r.adminReply && (
              <div className="mt-2 rounded-lg bg-muted/50 p-2.5 text-sm">
                <span className="font-semibold">স্টোরের উত্তর:</span> {r.adminReply}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════ নিরাপত্তা ═══════════════════════

function SecurityTab({ userId, name, email, phone }: { userId: string; name: string; email: string; phone: string }) {
  const navigate = useStore((s) => s.navigate);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const doChange = async () => {
    if (!current) return toast({ title: 'বর্তমান পাসওয়ার্ড দিন', variant: 'destructive' });
    if (next.length < 6) return toast({ title: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', variant: 'destructive' });
    if (next !== confirm) return toast({ title: 'নতুন পাসওয়ার্ড দুটি মিলছে না', variant: 'destructive' });
    setBusy(true);
    const res = await changePassword(userId, current, next);
    setBusy(false);
    if (res.ok) {
      toast({ title: 'পাসওয়ার্ড পরিবর্তন হয়েছে' });
      setCurrent(''); setNext(''); setConfirm('');
    } else {
      toast({ title: 'পরিবর্তন হয়নি', description: res.error, variant: 'destructive' });
    }
  };

  const doLogout = () => {
    logout();
    notifyAuthChanged();
    toast({ title: 'লগআউট হয়েছে' });
    navigate({ name: 'home' });
  };

  return (
    <div className="max-w-xl space-y-6">
      {/* অ্যাকাউন্ট তথ্য */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <User className="h-4 w-4 text-primary" /> অ্যাকাউন্ট তথ্য
        </h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {email || 'ইমেইল যোগ করা হয়নি'}</div>
          <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {phone || 'মোবাইল যোগ করা হয়নি'}</div>
        </div>
      </div>

      {/* পাসওয়ার্ড পরিবর্তন */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" /> পাসওয়ার্ড পরিবর্তন
        </h3>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sec-current">বর্তমান পাসওয়ার্ড</Label>
            <Input id="sec-current" className="mt-1.5" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="sec-next">নতুন পাসওয়ার্ড</Label>
              <Input id="sec-next" className="mt-1.5" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="কমপক্ষে ৬ অক্ষর" />
            </div>
            <div>
              <Label htmlFor="sec-confirm">নিশ্চিত করুন</Label>
              <Input id="sec-confirm" className="mt-1.5" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          <Button onClick={doChange} disabled={busy} className="font-semibold">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} পাসওয়ার্ড পরিবর্তন করুন
          </Button>
        </div>
      </div>

      {/* লগআউট */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={doLogout} className="font-semibold">
          <LogOut className="mr-2 h-4 w-4" /> লগআউট
        </Button>
      </div>

      {/* অ্যাকাউন্ট ডিলিট রিকোয়েস্ট */}
      <AccountDeletionCard userId={userId} />
    </div>
  );
}

// ═══════════════════════ অ্যাকাউন্ট ডিলিট রিকোয়েস্ট কার্ড ═══════════════════════

const DELETION_REASONS = [
  'আমার চাহিদা পূরণ হয়নি',
  'অন্য অ্যাকাউন্ট আছে',
  'গোপনীয়তা নিয়ে উদ্বেগ',
  'আর কেনাকাটা করবো না',
  'অন্যান্য',
];

function AccountDeletionCard({ userId }: { userId: string }) {
  const siteSettings = useStore((s) => s.siteSettings);
  const tick = useDbTick();
  const request = useMemo(() => latestDeletionRequest(userId), [userId, tick]);
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState<string>(DELETION_REASONS[0]);
  const [details, setDetails] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const enabled = siteSettings.deletion_enabled !== '0';
  const active = request && (request.status === 'PENDING' || request.status === 'PROCESSING');

  const submit = async () => {
    if (!confirmChecked) {
      toast({ title: 'নিশ্চিতকরণ টিক দিন', description: 'বুঝিয়ে নেওয়ার পর টিক দিয়ে সাবমিট করুন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const res = requestAccountDeletion(userId, reason, details);
    setBusy(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast({ title: 'অনুরোধ পাঠানো হয়েছে', description: 'অ্যাডমিন রিভিউ করে আপনাকে জানাবে' });
      setFormOpen(false);
      setDetails('');
      setConfirmChecked(false);
    } else {
      toast({ title: 'পাঠানো যায়নি', description: res.error, variant: 'destructive' });
    }
  };

  const doCancel = () => {
    const res = cancelDeletionRequest(userId);
    setCancelOpen(false);
    if (res.ok) toast({ title: 'অনুরোধ বাতিল হয়েছে' });
    else toast({ title: 'বাতিল করা যায়নি', description: res.error, variant: 'destructive' });
  };

  // অ্যাডমিন দ্বারা ফিচারটি বন্ধ — যোগাযোগের তথ্যসহ নোটিশ
  if (!enabled) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-destructive">
          <AlertTriangle className="h-4 w-4" /> অ্যাকাউন্ট ডিলিটের অনুরোধ
        </h3>
        <p className="text-sm text-muted-foreground">
          {siteSettings.deletion_info_text?.trim()
            ? siteSettings.deletion_info_text
            : 'অ্যাকাউন্ট ডিলিট করতে সহায়তা নিতে '}
          {!siteSettings.deletion_info_text?.trim() && (
            <>
              <a
                href={`mailto:${siteSettings.contact_email || 'support@theshopbd.com'}?subject=Account Deletion Request`}
                className="font-medium text-primary hover:underline"
              >
                {siteSettings.contact_email || 'support@theshopbd.com'}
              </a>{' '}
              -এ ইমেইল করুন অথবা হেল্পলাইনে কল করুন {siteSettings.contact_phone || '+৮৮০৯৬৪২-৯২২৯২২'}।
            </>
          )}
        </p>
      </div>
    );
  }

  const statusMeta = {
    PENDING: { label: 'পেন্ডিং', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', icon: Clock },
    PROCESSING: { label: 'প্রসেসিং', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300', icon: Loader2 },
    COMPLETED: { label: 'সম্পন্ন', cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300', icon: CheckCircle2 },
    REJECTED: { label: 'বাতিল', cls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', icon: XCircleIcon },
  } as const;

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-destructive">
        <UserX className="h-4 w-4" /> অ্যাকাউন্ট ডিলিটের অনুরোধ
      </h3>

      {/* চলমান / সর্বশেষ রিকোয়েস্টের স্ট্যাটাস */}
      {request ? (
        <div className="mb-3 rounded-lg border bg-background/80 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {(() => {
                const Meta = statusMeta[request.status];
                return (
                  <>
                    <Badge className={Meta.cls}>
                      <Meta.icon className={cn('mr-1 h-3 w-3', request.status === 'PROCESSING' && 'animate-spin')} />
                      {Meta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatBnDate(request.createdAt)}</span>
                  </>
                );
              })()}
            </div>
            {request.status === 'PENDING' && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCancelOpen(true)}>
                বাতিল করুন
              </Button>
            )}
          </div>
          {request.reason && (
            <p className="mt-2 text-xs text-muted-foreground">কারণ: <span className="font-medium text-foreground">{request.reason}</span></p>
          )}
          {request.adminNote && (
            <p className="mt-1.5 rounded-md bg-muted p-2 text-xs"><span className="font-semibold">অ্যাডমিন নোট:</span> {request.adminNote}</p>
          )}
          {request.status === 'COMPLETED' && (
            <p className="mt-2 text-xs text-green-700 dark:text-green-400">আপনার অনুরোধ প্রক্রিয়া করা হয়েছে। প্রয়োজনে আবার রিকোয়েস্ট পাঠাতে পারেন।</p>
          )}
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">
          অ্যাকাউন্ট ডিলিট করলে আপনার সব অর্ডার ইতিহাস, ঠিকানা ও পছন্দ স্থায়ীভাবে মুছে যাবে। নিচের বাটনে ক্লিক করে অনুরোধ পাঠান — অ্যাডমিন রিভিউ করে ব্যবস্থা নেবে।
        </p>
      )}

      {/* নতুন অনুরোধ ফর্ম (চলমান অনুরোধ না থাকলে) */}
      {!active && (
        <>
          {!formOpen ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setFormOpen(true); setConfirmChecked(false); }}
              className="font-semibold"
            >
              <UserX className="mr-2 h-4 w-4" /> {request?.status === 'REJECTED' || request?.status === 'COMPLETED' ? 'আবার অনুরোধ পাঠান' : 'ডিলিটের অনুরোধ পাঠান'}
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border bg-background p-4">
              <div>
                <Label className="text-xs font-semibold">ডিলিট করতে চাওয়ার কারণ</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DELETION_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        reason === r
                          ? 'border-destructive bg-destructive text-white shadow-sm'
                          : 'bg-background text-muted-foreground hover:border-destructive/40 hover:text-foreground'
                      )}
                      aria-pressed={reason === r}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="del-details" className="text-xs font-semibold">বিস্তারিত লিখুন (ঐচ্ছিক)</Label>
                <Textarea
                  id="del-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="আপনার মতামত বা অতিরিক্ত তথ্য..."
                  className="mt-1.5 min-h-20"
                  maxLength={500}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-muted/70 p-3">
                <Checkbox checked={confirmChecked} onCheckedChange={(v) => setConfirmChecked(v === true)} className="mt-0.5" />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  আমি বুঝেছি — অ্যাকাউন্ট ডিলিট হলে আমার প্রোফাইল, ঠিকানা ও পছন্দের তালিকা মুছে যাবে এবং এটি <strong className="text-foreground">ফিরিয়ে আনা সম্ভব নয়</strong>।
                </span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={busy} className="font-semibold">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} অনুরোধ সাবমিট করুন
                </Button>
                <Button variant="ghost" onClick={() => setFormOpen(false)}>বাতিল</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* সাবমিট কনফার্মেশন */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>সত্যিই অনুরোধ পাঠাবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              আপনার অনুরোধ অ্যাডমিন প্যানেলে জমা হবে। রিভিউ শেষে অ্যাডমিন আপনার অ্যাকাউন্ট ও ব্যক্তিগত ডেটা স্থায়ীভাবে মুছে ফেলবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={submit} className="bg-destructive text-white hover:bg-destructive/90">হ্যাঁ, পাঠান</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* বাতিল কনফার্মেশন */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>অনুরোধ বাতিল করবেন?</AlertDialogTitle>
            <AlertDialogDescription>আপনার পেন্ডিং ডিলিট রিকোয়েস্ট বাতিল হয়ে যাবে এবং অ্যাকাউন্ট যেমন আছে তেমনই থাকবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না</AlertDialogCancel>
            <AlertDialogAction onClick={doCancel}>হ্যাঁ, বাতিল করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════ মূল অ্যাকাউন্ট ভিউ ═══════════════════════

// ═══════════════════════ লয়ালটি পয়েন্ট ট্যাব ═══════════════════════

function LoyaltyTab({ user }: { user: import('@/lib/db/types').User }) {
  const settings = useStore((s) => s.siteSettings);
  useDbTick();
  const balance = loyaltyBalanceOf(user.id);
  const ledger = useMemo(
    () =>
      db
        .collection('loyaltyLedger')
        .filter((e) => e.userId === user.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 40),
    [user.id]
  );
  const earnRate = Number(settings.loyalty_earn_rate) || 1;
  const pointValue = Number(settings.loyalty_point_value) || 1;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">আপনার পয়েন্ট ব্যালেন্স</p>
            <p className="text-4xl font-extrabold">{toBn(balance)} <span className="text-base font-medium">পয়েন্ট</span></p>
            <p className="mt-1 text-xs opacity-90">মান ≈ {formatBDT(balance * pointValue)} ছাড়</p>
          </div>
          <Sparkles className="h-12 w-12 opacity-40" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Info className="h-4 w-4 text-primary" /> কীভাবে কাজ করে</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>• প্রতি ১০০৳-এর অর্ডারে <strong className="text-foreground">{toBn(earnRate)} পয়েন্ট</strong> অর্জন হয় (ডেলিভারি সম্পন্ন হলে)</li>
          <li>• পরের অর্ডারে চেকআউট পেজে পয়েন্ট খরচ করে <strong className="text-foreground">সরাসরি ছাড়</strong> নিন</li>
          <li>• ১ পয়েন্ট = {formatBDT(pointValue)}</li>
        </ul>
      </div>

      <div className="rounded-xl border bg-card">
        <h3 className="border-b p-4 text-sm font-bold">পয়েন্ট হিস্ট্রি</h3>
        {ledger.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            এখনো কোনো পয়েন্ট লেনদেন নেই — অর্ডার করে পয়েন্ট অর্জন শুরু করুন!
          </p>
        ) : (
          <div className="divide-y">
            {ledger.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.reason}</p>
                  <p className="text-[11px] text-muted-foreground">{formatBnDate(e.createdAt)}</p>
                </div>
                <span className={cn('shrink-0 text-sm font-extrabold', e.points >= 0 ? 'text-green-600' : 'text-destructive')}>
                  {e.points >= 0 ? '+' : '−'}{toBn(Math.abs(e.points))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════ রেফারেল ট্যাব ═══════════════════════

function ReferralTab({ user }: { user: import('@/lib/db/types').User }) {
  const settings = useStore((s) => s.siteSettings);
  useDbTick();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('বিকাশ');
  const [account, setAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // রেফারেল কোড — প্রথমবার তৈরি হয় (রেন্ডার-টাইম অ্যাডজাস্ট, আইডেম্পোটেন্ট)
  const [codeState, setCodeState] = useState(user.refCode || '');
  if (!codeState) {
    const generated = ensureRefCode(user);
    if (generated) setCodeState(generated);
  }
  const code = codeState;
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/login?mode=register&ref=${code}`
    : '';
  const balance = referralBalanceOf(user.id);
  const events = useMemo(
    () => db.collection('referralEvents').filter((e) => e.referrerUserId === user.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [user.id]
  );
  const withdraws = useMemo(
    () => db.collection('referralWithdraws').filter((w) => w.userId === user.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [user.id]
  );
  const minWithdraw = Number(settings.referral_min_withdraw) || 500;
  const percent = Number(settings.referral_percent) || 5;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(`${code} — ${shareUrl}`);
      toast({ title: 'কোড ও লিংক কপি হয়েছে!' });
    } catch {
      toast({ title: 'কপি করা যায়নি', variant: 'destructive' });
    }
  };

  const submitWithdraw = () => {
    setSubmitting(true);
    const res = requestReferralWithdraw(user, Number(amount) || 0, method, account);
    setSubmitting(false);
    if (!res.ok) {
      toast({ title: 'আবেদন হয়নি', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'আবেদন জমা হয়েছে!', description: 'অ্যাডমিন যাচাই করে টাকা পাঠাবেন' });
    setAmount('');
    setAccount('');
  };

  return (
    <div className="space-y-4">
      {/* কোড ও শেয়ার */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Gift className="h-4 w-4 text-primary" /> আপনার রেফারেল কোড</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-secondary px-4 py-2.5 text-lg font-extrabold tracking-widest text-primary">{code}</code>
          <Button variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> কপি করুন
          </Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          বন্ধুকে এই লিংক পাঠান — তার প্রথম অর্ডার <strong className="text-foreground">ডেলিভারি</strong> হলে
          আপনি অর্ডারের <strong className="text-primary">{toBn(percent)}%</strong> কমিশন পাবেন:
          <span className="mt-1 block break-all font-mono text-[11px] text-foreground">{shareUrl}</span>
        </p>
      </div>

      {/* ব্যালেন্স */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <Users className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-1 text-2xl font-extrabold">{toBn(events.length)}</p>
          <p className="text-xs text-muted-foreground">সফল রেফার</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <Gift className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-1 text-2xl font-extrabold">{formatBDT(events.reduce((s, e) => s + e.commission, 0))}</p>
          <p className="text-xs text-muted-foreground">মোট আর্জিত</p>
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-center">
          <Wallet className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-1 text-2xl font-extrabold text-primary">{formatBDT(balance)}</p>
          <p className="text-xs text-muted-foreground">তোলার মতো ব্যালেন্স</p>
        </div>
      </div>

      {/* উইথড্র ফর্ম */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-bold">কমিশন তুলুন</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">সর্বনিম্ন {formatBDT(minWithdraw)} তোলা যায় (ব্যালেন্স: {formatBDT(balance)})</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            aria-label="টাকা পাঠানোর মাধ্যম"
          >
            {['বিকাশ', 'নগদ', 'রকেট', 'ব্যাংক ট্রান্সফার'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="অ্যাকাউন্ট নম্বর" />
          <div className="flex gap-2">
            <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="পরিমাণ (৳)" />
            <Button onClick={submitWithdraw} disabled={submitting || !amount || !account.trim()}>পাঠান</Button>
          </div>
        </div>
      </div>

      {/* হিস্ট্রি */}
      <div className="rounded-xl border bg-card">
        <h3 className="border-b p-4 text-sm font-bold">কমিশন হিস্ট্রি</h3>
        {events.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            এখনো কোনো রেফারেল নেই — কোড শেয়ার করে আয় শুরু করুন!
          </p>
        ) : (
          <div className="divide-y">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {e.referredName || 'ক্রেতা'} — অর্ডার {e.orderNumber}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBnDate(e.createdAt)} · অর্ডার মূল্য {formatBDT(e.orderTotal)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-extrabold text-green-600">+{formatBDT(e.commission)}</p>
                  <span className="text-[10px] font-semibold text-muted-foreground">{e.status === 'APPROVED' ? 'অনুমোদিত' : e.status === 'PENDING' ? 'অপেক্ষমাণ' : 'বাতিল'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {withdraws.length > 0 && (
          <>
            <h3 className="border-t border-b p-4 text-sm font-bold">তোলার আবেদন</h3>
            <div className="divide-y">
              {withdraws.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div>
                    <p className="text-sm font-medium">{formatBDT(w.amount)} — {w.method} ({w.account})</p>
                    <p className="text-[11px] text-muted-foreground">{formatBnDate(w.createdAt)}</p>
                  </div>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    w.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                      : w.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  )}>
                    {w.status === 'PAID' ? 'পরিশোধিত' : w.status === 'REJECTED' ? 'বাতিল' : 'প্রসেসিং'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AccountView({ tab }: { tab?: AccountTab }) {
  const navigate = useStore((s) => s.navigate);
  const { user, ready } = useCurrentUser();
  useDbTick(); // যেকোনো DB পরিবর্তনে (নোটিফিকেশন ব্যাজ সহ) রি-রেন্ডার

  const activeTab: AccountTab = tab && TAB_META.some((t) => t.key === tab) ? tab : 'dashboard';

  // লগইন না থাকলে
  if (ready && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <User className="h-9 w-9 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold">লগইন করুন</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          আপনার অর্ডার, উইশলিস্ট, ঠিকানা ও সাপোর্ট টিকেট দেখতে অ্যাকাউন্টে লগইন করুন।
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => navigate({ name: 'auth', mode: 'login' })} className="font-semibold">লগইন করুন</Button>
          <Button variant="outline" onClick={() => navigate({ name: 'auth', mode: 'register' })}>
            নতুন অ্যাকাউন্ট খুলুন
          </Button>
        </div>
      </div>
    );
  }

  if (!ready || !user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const unread = unreadNotificationCount(user.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* হেডার */}
      <div className="mb-5 flex items-center gap-4">
        <Avatar className="h-14 w-14 border">
          {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
          <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
            {user.name.charAt(0) || 'গ'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold sm:text-xl">আমার অ্যাকাউন্ট</h1>
          <p className="truncate text-sm text-muted-foreground">
            {user.name} · {user.phone || user.email || ''}
          </p>
        </div>
      </div>

      {/* মোবাইল: horizontal scroll ট্যাব বার */}
      <div className="mb-4 overflow-x-auto scrollbar-thin lg:hidden">
        <div className="flex gap-2 pb-1">
          {TAB_META.map((t) => (
            <button
              key={t.key}
              onClick={() => navigate({ name: 'account', tab: t.key })}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors',
                activeTab === t.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.key === 'notifications' && unread > 0 && (
                <span className={cn(
                  'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold',
                  activeTab === t.key ? 'bg-white/25' : 'bg-destructive text-white'
                )}>
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* ডেস্কটপ সাইডবার */}
        <aside className="hidden h-fit rounded-xl border bg-card p-2 lg:sticky lg:top-32 lg:block">
          <nav className="flex flex-col gap-0.5" aria-label="অ্যাকাউন্ট মেনু">
            {TAB_META.map((t) => (
              <button
                key={t.key}
                onClick={() => navigate({ name: 'account', tab: t.key })}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                  activeTab === t.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                aria-current={activeTab === t.key ? 'page' : undefined}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.key === 'notifications' && unread > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
            ))}
            <Separator className="my-2" />
            <button
              onClick={() => { logout(); notifyAuthChanged(); toast({ title: 'লগআউট হয়েছে' }); navigate({ name: 'home' }); }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> লগআউট
            </button>
          </nav>
        </aside>

        {/* কনটেন্ট */}
        <div>
          {activeTab === 'dashboard' && <DashboardTab userId={user.id} />}
          {activeTab === 'orders' && <OrdersTab userId={user.id} />}
          {activeTab === 'profile' && (
            <ProfileTab
              key={`${user.id}|${user.name}|${user.email || ''}|${user.phone || ''}|${user.dateOfBirth || ''}|${user.avatar || ''}`}
              userId={user.id}
              name={user.name}
              email={user.email || ''}
              phone={user.phone || ''}
              avatar={user.avatar || null}
              dob={user.dateOfBirth || ''}
              newsletter={user.newsletterSubscribed}
            />
          )}
          {activeTab === 'addresses' && <AddressesTab userId={user.id} />}
          {activeTab === 'notifications' && <NotificationsTab userId={user.id} />}
          {activeTab === 'tickets' && (
            <TicketsTab userId={user.id} name={user.name} email={user.email || ''} phone={user.phone || ''} />
          )}
          {activeTab === 'reviews' && <ReviewsTab userId={user.id} />}
          {activeTab === 'loyalty' && <LoyaltyTab user={user} />}
          {activeTab === 'referral' && <ReferralTab user={user} />}
          {activeTab === 'security' && (
            <SecurityTab userId={user.id} name={user.name} email={user.email || ''} phone={user.phone || ''} />
          )}
        </div>
      </div>
    </div>
  );
}

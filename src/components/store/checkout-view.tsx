'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MapPin, User, Phone, StickyNote, ShieldCheck, CheckCircle2, Loader2,
  Tag, Plus, ChevronDown, Truck, Wallet, X, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { useCurrentUser, notifyAuthChanged, useCollection } from '@/lib/db/hooks';
import {
  placeOrder, validateCoupon, deliveryZones, paymentMethodsList, calcShipping,
  type CouponResult,
} from '@/lib/db/services';
import {
  loyaltyBalanceOf, loyaltyPointValue, loyaltyMaxRedeemPoints,
} from '@/lib/db/growth';
import { trackBeginCheckout } from '@/lib/analytics';
import type { Address } from '@/lib/db/types';
import { formatBDT, toBn } from '@/lib/types';
import { cn } from '@/lib/utils';
import { GeoAddressFields, type GeoValue } from '@/components/store/geo-address-fields';

const COUPON_KEY = 'tsb_coupon';
const PHONE_RE = /^01[3-9]\d{8}$/;

function PayLogo({ logo, name }: { logo?: string | null; name: string }) {
  if (logo) {
    return <img src={logo} alt={name} className="h-8 w-12 shrink-0 object-contain" />;
  }
  return <Wallet className="h-5 w-5 shrink-0 text-primary" />;
}

export function CheckoutView() {
  const navigate = useStore((s) => s.navigate);
  const siteSettings = useStore((s) => s.siteSettings);
  const { user, ready } = useCurrentUser();
  const allAddresses = useCollection('addresses');

  const [cartReady, setCartReady] = useState(false);
  const [cartItems, setCartItems] = useState<import('@/lib/db/services').HydratedCartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: '', phone: '', email: '', division: '', district: '', city: '', area: '', address: '',
  });
  const [saveThisAddress, setSaveThisAddress] = useState(true);

  const zones = useMemo(() => deliveryZones(), []);
  const methods = useMemo(() => {
    const base = paymentMethodsList();
    // অনলাইন গেটওয়ে (অ্যাডমিন কনফিগ করলেই দেখায়)
    const extra: typeof base = [];
    if (siteSettings.bkash_enabled === '1') {
      extra.push({
        id: 'gateway_bkash', name: 'bKash (অনলাইন পেমেন্ট)', type: 'mobile_banking' as const,
        logo: null, accountNumber: null, instructions: 'bKash অ্যাপ/ওয়েবের নিরাপদ পেজে নিয়ে যাওয়া হবে',
        needsTrxId: false, active: true, sortOrder: 0,
      });
    }
    if (siteSettings.sslcz_enabled === '1') {
      extra.push({
        id: 'gateway_sslcz', name: 'কার্ড / অনলাইন পেমেন্ট (SSLCommerz)', type: 'card' as const,
        logo: null, accountNumber: null, instructions: 'Visa/Mastercard, মোবাইল ব্যাংকিং, নেট ব্যাংকিং',
        needsTrxId: false, active: true, sortOrder: 1,
      });
    }
    return [...base, ...extra];
     
  }, [siteSettings.bkash_enabled, siteSettings.sslcz_enabled]);
  const codMethod = methods.find((m) => m.type === 'cod') ?? methods[0];

  const [zonePick, setZonePick] = useState<{ id: string; district: string } | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [trxId, setTrxId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');

  // কুপন প্রি-ফিল (কার্ট পেজে প্রয়োগ করা থাকলে) — lazy init + ডেরাইভড ভ্যালিডেশন
  const [couponCode, setCouponCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = sessionStorage.getItem(COUPON_KEY);
      if (raw) {
        const { code } = JSON.parse(raw) as { code: string };
        return code || '';
      }
    } catch {
      // ignore
    }
    return '';
  });
  const coupon = useMemo(() => {
    if (!couponCode.trim()) return null;
    const res = validateCoupon(couponCode.trim(), subtotal);
    return res.ok ? res : null;
  }, [couponCode, subtotal]);
  const [note, setNote] = useState('');

  // কার্ট লোড (লোকাল সার্ভিস থেকে)
  useEffect(() => {
    import('@/lib/db/services').then(({ getCart }) => {
      const c = getCart();
      setCartItems(c.items);
      setSubtotal(c.subtotal);
      setCartReady(true);
      if (c.items.length) trackBeginCheckout(c.subtotal, c.count);
    });
  }, []);

  // ইউজার প্রোফাইল থেকে প্রি-ফিল + সেভ করা ঠিকানা (রেন্ডার-টাইম অ্যাডজাস্ট)
  const myAddresses = useMemo(
    () => (user ? allAddresses.filter((a) => a.userId === user.id) : []),
    [allAddresses, user]
  );

  const addrSyncKey = ready ? `u${user?.id || 'guest'}-n${myAddresses.length}` : 'wait';
  const [syncedAddrKey, setSyncedAddrKey] = useState('');
  if (addrSyncKey !== syncedAddrKey) {
    setSyncedAddrKey(addrSyncKey);
    if (ready) {
      const defaults = myAddresses.filter((a) => a.isDefaultShipping);
      const first = defaults[0] || myAddresses[0];
      if (first) {
        setSelectedAddr(first.id);
        setForm({
          customerName: first.name,
          phone: first.phone,
          email: user?.email || '',
          division: first.division || '',
          district: first.district,
          city: first.city,
          area: first.area || '',
          address: first.fullAddress,
        });
        setShowNewAddress(false);
      } else if (user) {
        setForm((f) => ({
          ...f,
          customerName: f.customerName || user.name,
          phone: f.phone || user.phone || '',
          email: f.email || user.email || '',
        }));
        setShowNewAddress(true);
      } else {
        setShowNewAddress(true);
      }
    }
  }

  // জেলা সিলেক্ট হলে সেই জেলার ডেলিভারি জোন অটো-সিলেক্ট — পিওর ডেরাইভেশন (ইফেক্ট ছাড়া):
  // • ইউজারের হাতে পিক করা জোন (zonePick) সেই একই জেলার জন্য হলে সেটিই থাকে;
  // • জেলা বদলালে অটো-ম্যাচ জোন (বা 'সকল জেলা' ক্যাচ-অল) কার্যকর হয়।
  const autoZoneId = useMemo(() => {
    const d = form.district.trim();
    if (!d || zones.length === 0) return null;
    const exact = zones.find((z) => z.active && z.districts.some((x) => x.trim() === d));
    if (exact) return exact.id;
    return zones.find((z) => z.active && z.districts.some((x) => x.trim() === 'সকল জেলা'))?.id ?? null;
  }, [form.district, zones]);

  // ডিফল্ট জোন ও পেমেন্ট মেথড — ডেরাইভড (ইউজার নির্বাচন করলে স্টেট সেট হয়)
  const zonePickValid =
    zonePick !== null &&
    zonePick.district === form.district.trim() &&
    zones.some((z) => z.id === zonePick.id);
  const effectiveZoneId = zonePickValid
    ? zonePick.id
    : autoZoneId ?? zones[0]?.id ?? null;
  const effectivePaymentId =
    paymentMethodId && methods.some((m) => m.id === paymentMethodId)
      ? paymentMethodId
      : codMethod?.id ?? methods[0]?.id ?? '';

  const selectedMethod = methods.find((m) => m.id === effectivePaymentId) ?? null;
  const freeShippingCoupon = coupon?.freeShipping ?? false;
  const couponDiscount = coupon?.discount ?? 0;

  const shipping = useMemo(
    () => calcShipping(effectiveZoneId, subtotal, freeShippingCoupon).charge,
    [effectiveZoneId, subtotal, freeShippingCoupon]
  );

  const tax = useMemo(() => {
    if (siteSettings.tax_enabled === '1' && siteSettings.tax_inclusive !== '1') {
      return Math.round((subtotal * (Number(siteSettings.tax_percent) || 0)) / 100);
    }
    return 0;
  }, [siteSettings, subtotal]);

  // ── লয়ালটি পয়েন্ট ──
  const loyaltyOn = siteSettings.loyalty_enabled === '1';
  const pointValue = loyaltyPointValue();
  const pointBalance = loyaltyBalanceOf(user?.id ?? null);
  const [usePointsInput, setUsePointsInput] = useState('');
  const maxRedeemable = loyaltyMaxRedeemPoints(Math.max(0, subtotal - couponDiscount) + shipping + tax);
  const pointsToUse = useMemo(() => {
    if (!loyaltyOn || !user || pointBalance <= 0 || maxRedeemable <= 0) return 0;
    const n = Math.floor(Number(usePointsInput) || 0);
    return Math.max(0, Math.min(n, pointBalance, maxRedeemable));
  }, [loyaltyOn, user, pointBalance, maxRedeemable, usePointsInput]);
  const pointsDiscount = pointsToUse > 0 ? Math.round(pointsToUse * pointValue) : 0;

  const total = Math.max(0, subtotal - couponDiscount - pointsDiscount) + shipping + tax;
  const selectedZone = zones.find((z) => z.id === effectiveZoneId) ?? null;

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const pickAddress = (id: string) => {
    setSelectedAddr(id);
    const a = myAddresses.find((x) => x.id === id);
    if (a) {
      setForm({
        customerName: a.name,
        phone: a.phone,
        email: user?.email || '',
        division: a.division || '',
        district: a.district,
        city: a.city,
        area: a.area || '',
        address: a.fullAddress,
      });
      setShowNewAddress(false);
    }
  };

  const applyCoupon = () => {
    if (!couponCode.trim()) {
      removeCoupon();
      return;
    }
    const res = validateCoupon(couponCode.trim(), subtotal);
    if (res.ok) {
      sessionStorage.setItem(COUPON_KEY, JSON.stringify({ code: res.coupon.code }));
      toast({ title: 'কুপন প্রয়োগ হয়েছে', description: res.message });
    } else {
      toast({ title: 'কুপন প্রযোজ্য নয়', description: res.error, variant: 'destructive' });
    }
  };

  const removeCoupon = () => {
    setCouponCode('');
    try {
      sessionStorage.removeItem(COUPON_KEY);
    } catch {
      // ignore
    }
  };

  const validate = (): string | null => {
    if (!form.customerName.trim()) return 'আপনার নাম লিখুন';
    if (!PHONE_RE.test(form.phone.trim())) return 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01712345678)';
    if (!form.address.trim()) return 'সম্পূর্ণ ঠিকানা লিখুন';
    if (!form.district.trim()) return 'জেলা লিখুন';
    if (!form.city.trim()) return 'শহর/উপজেলা লিখুন';
    if (!effectiveZoneId) return 'ডেলিভারি জোন নির্বাচন করুন';
    if (!effectivePaymentId) return 'পেমেন্ট মেথড নির্বাচন করুন';
    if (selectedMethod?.needsTrxId && !trxId.trim()) return `${selectedMethod.name}-এর Transaction ID দিন`;
    return null;
  };

  const submit = async () => {
    if (submitting) return;
    const err = validate();
    if (err) {
      toast({ title: err, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const isBkash = effectivePaymentId === 'gateway_bkash';
    const isSslcz = effectivePaymentId === 'gateway_sslcz';
    const res = placeOrder({
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      address: form.address.trim(),
      division: form.division.trim() || null,
      district: form.district.trim(),
      city: form.city.trim(),
      area: form.area.trim() || null,
      zoneId: effectiveZoneId,
      paymentMethodId: isBkash || isSslcz ? 'pay_1' : effectivePaymentId,
      paymentMethodNameOverride: isBkash ? 'bKash (অনলাইন)' : isSslcz ? 'SSLCommerz (অনলাইন)' : undefined,
      trxId: selectedMethod?.needsTrxId ? trxId.trim() : null,
      senderNumber: selectedMethod?.needsTrxId ? senderNumber.trim() || null : null,
      couponCode: coupon?.coupon.code ?? null,
      note: note.trim() || null,
      saveAddress: !!user && saveThisAddress && (selectedAddr === null || showNewAddress),
      usePoints: pointsToUse,
    });

    if (!res.ok) {
      setSubmitting(false);
      toast({ title: 'অর্ডার সম্পন্ন হয়নি', description: res.error, variant: 'destructive' });
      return;
    }

    try {
      sessionStorage.removeItem(COUPON_KEY);
    } catch {
      // ignore
    }
    notifyAuthChanged();

    // ── অনলাইন গেটওয়ে রিডাইরেক্ট ──
    if (isBkash || isSslcz) {
      try {
        const api = isBkash ? '/api/pay/bkash/create' : '/api/pay/sslcz/init';
        const r = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderNumber: res.order.orderNumber }),
        });
        const data = (await r.json()) as { ok?: boolean; bkashURL?: string; gatewayURL?: string; error?: string };
        const url = data.bkashURL || data.gatewayURL;
        if (data.ok && url) {
          window.location.href = url;
          return; // রিডাইরেক্ট হচ্ছে — লোডিং চালু রাখো
        }
        toast({ title: 'গেটওয়ে সমস্যা', description: data.error || 'পেমেন্ট গেটওয়ে সংযোগ ব্যর্থ — অর্ডারটি পেন্ডিং আছে', variant: 'destructive' });
      } catch {
        toast({ title: 'গেটওয়ে সংযোগ ব্যর্থ', description: 'অর্ডারটি পেন্ডিং আছে — পরে আবার চেষ্টা করুন', variant: 'destructive' });
      }
    }

    setSubmitting(false);
    toast({ title: 'অর্ডার সফল হয়েছে!', description: `অর্ডার নম্বর: ${res.order.orderNumber}` });
    navigate({ name: 'order-success', orderNumber: res.order.orderNumber });
  };

  // কার্ট খালি → শপে ফেরত
  if (cartReady && cartItems.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">কার্ট খালি</h1>
        <p className="mt-2 text-sm text-muted-foreground">অর্ডার করার জন্য প্রথমে পণ্য কার্টে যোগ করুন</p>
        <Button className="mt-6" onClick={() => navigate({ name: 'shop' })}>কেনাকাটা শুরু করুন</Button>
      </div>
    );
  }

  if (!cartReady) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-muted lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold sm:text-2xl">চেকআউট</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {user ? `স্বাগতম, ${user.name}!` : 'গেস্ট হিসেবে অর্ডার করছেন'} নিচের তথ্য পূরণ করে অর্ডার নিশ্চিত করুন
      </p>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-5 lg:col-span-3">
          {/* ১. ঠিকানা */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{toBn(1)}</span>
              <MapPin className="h-4 w-4 text-primary" /> ডেলিভারি ঠিকানা
            </h2>

            {user && myAddresses.length > 0 && (
              <RadioGroup
                value={selectedAddr ?? ''}
                onValueChange={pickAddress}
                className="mb-4 gap-2"
              >
                {myAddresses.map((a: Address) => (
                  <label
                    key={a.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors',
                      selectedAddr === a.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                    )}
                  >
                    <RadioGroupItem value={a.id} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {a.label}
                        {a.isDefaultShipping && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">ডিফল্ট</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {a.name} · {a.phone}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {a.fullAddress}, {a.city}, {a.district}
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}

            {user && myAddresses.length > 0 && (
              <button
                type="button"
                onClick={() => { setShowNewAddress((v) => !v); if (!showNewAddress) setSelectedAddr(null); }}
                className="mb-4 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="h-4 w-4" /> {showNewAddress ? 'ফর্ম লুকান' : 'নতুন ঠিকানা যোগ করুন'}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showNewAddress && 'rotate-180')} />
              </button>
            )}

            {(showNewAddress || !user || myAddresses.length === 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="co-name">আপনার নাম <span className="text-destructive">*</span></Label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="co-name" className="pl-9" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="পুরো নাম" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="co-phone">মোবাইল নম্বর <span className="text-destructive">*</span></Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="co-phone" className="pl-9" inputMode="numeric" maxLength={11} value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} placeholder="01XXXXXXXXX" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="co-email">ইমেইল (ঐচ্ছিক)</Label>
                  <Input id="co-email" className="mt-1.5" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@email.com" />
                </div>
                {/* বিভাগ → জেলা → থানা → ইউনিয়ন অটো ক্যাসকেড (unifiedapi ডেটা) */}
                <div className="sm:col-span-2">
                  <GeoAddressFields
                    value={{ division: form.division, district: form.district, city: form.city, area: form.area }}
                    onChange={(v: GeoValue) =>
                      setForm((f) => ({ ...f, division: v.division, district: v.district, city: v.city, area: v.area }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="co-address">এলাকা সম্পূর্ণ ঠিকানা <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="co-address"
                    className="mt-1.5"
                    rows={2}
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    placeholder="বাসা নম্বর, রোড, গলি, দোকান/ল্যান্ডমার্ক..."
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    বিভাগ, জেলা, থানা ও ইউনিয়ন সিলেক্ট করার পর এখানে আপনার সম্পূর্ণ এলাকা ঠিকানা লিখুন
                  </p>
                </div>
                {user && (
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Checkbox
                      id="save-addr"
                      checked={saveThisAddress}
                      onCheckedChange={(v) => setSaveThisAddress(v === true)}
                    />
                    <Label htmlFor="save-addr" className="cursor-pointer text-sm font-normal">
                      এই ঠিকানা সেভ করুন
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ২. ডেলিভারি জোন */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{toBn(2)}</span>
              <Truck className="h-4 w-4 text-primary" /> ডেলিভারি জোন
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              জেলা সিলেক্ট করলে জোন অটোমেটিক সেট হয় — প্রয়োজনে নিচে বদলাতে পারবেন
            </p>
            <RadioGroup value={effectiveZoneId ?? ''} onValueChange={(v) => setZonePick({ id: v, district: form.district.trim() })} className="gap-3">
              {zones.map((z) => (
                <label
                  key={z.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors',
                    effectiveZoneId === z.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                  )}
                >
                  <RadioGroupItem value={z.id} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                      {z.name}
                      <span className="text-primary">{formatBDT(z.charge)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      ডেলিভারি সময়: {z.eta}
                      {z.freeShippingOver ? ` · ${formatBDT(z.freeShippingOver)}+ অর্ডারে ফ্রি ডেলিভারি` : ''}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {z.codAvailable ? 'ক্যাশ অন ডেলিভারি সুবিধা আছে' : 'অনলাইন পেমেন্ট প্রযোজ্য'}
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* ৩. পেমেন্ট মেথড */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{toBn(3)}</span>
              <ShieldCheck className="h-4 w-4 text-primary" /> পেমেন্ট মেথড
            </h2>
            <RadioGroup value={effectivePaymentId} onValueChange={setPaymentMethodId} className="gap-3">
              {methods.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors',
                    effectivePaymentId === m.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                  )}
                >
                  <RadioGroupItem value={m.id} className="mt-0.5" />
                  <PayLogo logo={m.logo} name={m.name} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{m.name}</div>
                    {m.instructions && <div className="text-xs text-muted-foreground">{m.instructions}</div>}
                    {effectivePaymentId === m.id && m.needsTrxId && (
                      <div className="mt-3 rounded-lg bg-secondary p-3">
                        {m.accountNumber && (
                          <p className="mb-2 text-xs font-medium">
                            <span className="text-muted-foreground">পেমেন্ট করুন:</span>{' '}
                            <span className="text-foreground">{m.accountNumber}</span> — নির্ধারিত অংক{' '}
                            <strong className="text-primary">{formatBDT(total)}</strong>
                          </p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder="ট্রানজেকশন আইডি (TrxID) *"
                            value={trxId}
                            onChange={(e) => setTrxId(e.target.value)}
                            aria-label="ট্রানজেকশন আইডি"
                          />
                          <Input
                            placeholder="আপনার নম্বর (ঐচ্ছিক)"
                            value={senderNumber}
                            onChange={(e) => setSenderNumber(e.target.value)}
                            aria-label="প্রেরকের নম্বর"
                          />
                        </div>
                      </div>
                    )}
                    {effectivePaymentId === m.id && m.type === 'cod' && (
                      <div className="mt-2 rounded-lg bg-secondary p-2.5 text-xs text-muted-foreground">
                        পণ্য হাতে পেয়ে কুরিয়ারকে {formatBDT(total)} পরিশোধ করবেন।
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* ৪. কুপন ও নোট */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{toBn(4)}</span>
              <Tag className="h-4 w-4 text-primary" /> কুপন ও অর্ডার নোট
            </h2>
            <Label htmlFor="co-coupon" className="mb-1.5 block text-sm">কুপন কোড</Label>
            {coupon ? (
              <div className="flex items-center justify-between rounded-lg bg-green-50 p-2.5 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                <span>
                  {coupon.coupon.code} প্রয়োগ হয়েছে
                  {coupon.discount > 0 ? ` (-${formatBDT(coupon.discount)})` : ' — ফ্রি ডেলিভারি'}
                </span>
                <button onClick={removeCoupon} aria-label="কুপন বাদ দিন">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="co-coupon"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="যেমন: SHOP10"
                />
                <Button variant="secondary" onClick={applyCoupon}>প্রয়োগ</Button>
              </div>
            )}
            <div className="mt-4">
              <Label htmlFor="co-note" className="mb-1.5 flex items-center gap-1.5 text-sm">
                <StickyNote className="h-3.5 w-3.5" /> অর্ডার নোট (ঐচ্ছিক)
              </Label>
              <Textarea
                id="co-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="বিশেষ কোনো নির্দেশনা থাকলে লিখুন..."
              />
            </div>
          </div>

          {/* ৫. লয়ালটি পয়েন্ট (চালু থাকলে) */}
          {loyaltyOn && user && pointBalance > 0 && maxRedeemable > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="mb-1 flex items-center gap-2 font-bold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{toBn(5)}</span>
                <Sparkles className="h-4 w-4 text-primary" /> লয়ালটি পয়েন্ট ব্যবহার করুন
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                বর্তমান ব্যালেন্স: <strong className="text-primary">{toBn(pointBalance)} পয়েন্ট</strong> (৳১ পয়েন্ট = {formatBDT(pointValue)}) — সর্বোচ্চ {toBn(maxRedeemable)} পয়েন্ট ব্যবহার করা যাবে
              </p>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  value={usePointsInput}
                  onChange={(e) => setUsePointsInput(e.target.value.replace(/\D/g, ''))}
                  placeholder={`পয়েন্ট সংখ্যা (সর্বোচ্চ ${toBn(maxRedeemable)})`}
                  aria-label="ব্যবহারযোগ্য পয়েন্ট"
                />
                <Button variant="secondary" onClick={() => setUsePointsInput(String(maxRedeemable))}>সর্বোচ্চ</Button>
                {usePointsInput && (
                  <Button variant="ghost" onClick={() => setUsePointsInput('')}>মুছুন</Button>
                )}
              </div>
              {pointsDiscount > 0 && (
                <p className="mt-2 rounded-lg bg-green-50 p-2.5 text-sm font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                  {toBn(pointsToUse)} পয়েন্ট = −{formatBDT(pointsDiscount)} ছাড়!
                </p>
              )}
            </div>
          )}
        </div>

        {/* ৫. অর্ডার সামারি */}
        <div className="h-fit rounded-xl border bg-card p-5 lg:col-span-2 lg:sticky lg:top-32">
          <h2 className="font-bold">আপনার অর্ডার</h2>
          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto scrollbar-thin pr-1">
            {cartItems.map((it) => (
              <div key={`${it.productId}-${it.variantKey}`} className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {it.image ? (
                    <img src={it.image} alt={it.product.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{it.product.nameBn || it.product.name}</div>
                  {it.variant && (it.variant.color || it.variant.size) && (
                    <div className="text-[11px] font-medium text-primary">
                      {[it.variant.color, it.variant.size].filter(Boolean).join(', ')}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{toBn(it.quantity)} × {formatBDT(it.unitPrice)}</div>
                </div>
                <div className="text-sm font-bold">{formatBDT(it.lineTotal)}</div>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">সাবটোটাল</span>
              <span className="font-medium">{formatBDT(subtotal)}</span>
            </div>
            {coupon && couponDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>কুপন ছাড় ({coupon.coupon.code})</span>
                <span className="font-medium">−{formatBDT(couponDiscount)}</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>লয়ালটি পয়েন্ট ({toBn(pointsToUse)})</span>
                <span className="font-medium">−{formatBDT(pointsDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                ডেলিভারি চার্জ{selectedZone ? ` (${selectedZone.name})` : ''}
              </span>
              <span className="font-medium">
                {shipping === 0 ? <span className="text-green-600">ফ্রি</span> : formatBDT(shipping)}
              </span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ভ্যাট/ট্যাক্স</span>
                <span className="font-medium">{formatBDT(tax)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base">
              <span className="font-bold">সর্বমোট</span>
              <span className="font-extrabold text-primary">{formatBDT(total)}</span>
            </div>
          </div>

          <Button
            size="lg"
            className="mt-5 w-full font-bold"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> প্রসেস হচ্ছে...</>
            ) : (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> অর্ডার নিশ্চিত করুন — {formatBDT(total)}</>
            )}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            অর্ডার করার মাধ্যমে আপনি আমাদের শর্তাবলীতে সম্মত হচ্ছেন
          </p>
        </div>
      </div>
    </div>
  );
}

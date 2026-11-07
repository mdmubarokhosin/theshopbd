'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2, Minus, Plus, ArrowRight, ShoppingBag, Tag, X, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from './home-view';
import { useStore } from '@/lib/store';
import { useCart } from '@/lib/use-cart';
import { toast } from '@/hooks/use-toast';
import { formatBDT, toBn } from '@/lib/types';
import { validateCoupon, deliveryZones, calcShipping, type CouponResult } from '@/lib/db/services';
import { BiIcon } from '@/lib/icons';

const COUPON_KEY = 'tsb_coupon';

/** কার্ট ইমেজ — ডেটা-URL বা লোকাল পাথ দুটোই সাপোর্ট করে */
function CartImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return <div className="flex h-full w-full items-center justify-center"><ShoppingBag className="h-8 w-8 text-muted-foreground/30" /></div>;
  }
  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}

export function CartView() {
  const navigate = useStore((s) => s.navigate);
  const toggleWishlist = useStore((s) => s.toggleWishlist);
  const { items, subtotal, count, updateItem, removeItem } = useCart();

  const [hydrated, setHydrated] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<CouponResult & { ok: true } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // sessionStorage থেকে কুপন পুনরুদ্ধার + যাচাই
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(COUPON_KEY);
        if (raw) {
          const { code } = JSON.parse(raw) as { code: string };
          if (code) {
            setCouponCode(code);
            const res = validateCoupon(code, subtotal);
            if (res.ok) setCoupon(res);
            else sessionStorage.removeItem(COUPON_KEY);
          }
        }
      } catch {
        // ignore
      }
      setHydrated(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const couponDiscount = coupon?.discount ?? 0;
  const couponFreeShipping = coupon?.freeShipping ?? false;

  // ডেলিভারি চার্জ প্রাক্কলন — প্রথম সক্রিয় জোন ধরে
  const shippingEstimate = useMemo(() => {
    const zones = deliveryZones();
    if (!zones.length) return 0;
    return calcShipping(zones[0]?.id ?? null, subtotal, couponFreeShipping).charge;
  }, [subtotal, couponFreeShipping]);

  const total = Math.max(0, subtotal - couponDiscount) + shippingEstimate;

  const applyCoupon = () => {
    if (!couponCode.trim()) {
      toast({ title: 'কুপন কোড লিখুন', variant: 'destructive' });
      return;
    }
    setCouponLoading(true);
    // ছোট ডিলে — লোডিং ফিডব্যাকের জন্য
    setTimeout(() => {
      const res = validateCoupon(couponCode.trim(), subtotal);
      setCouponLoading(false);
      if (res.ok) {
        setCoupon(res);
        sessionStorage.setItem(COUPON_KEY, JSON.stringify({ code: res.coupon.code }));
        toast({ title: 'কুপন প্রয়োগ হয়েছে', description: res.message });
      } else {
        toast({ title: 'কুপন প্রযোজ্য নয়', description: res.error, variant: 'destructive' });
      }
    }, 250);
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponCode('');
    try {
      sessionStorage.removeItem(COUPON_KEY);
    } catch {
      // ignore
    }
  };

  const sendToWishlist = (productId: string, variantKey: string) => {
    const already = useStore.getState().wishlist.includes(productId);
    if (!already) toggleWishlist(productId);
    removeItem(productId, variantKey);
    toast({ title: 'উইশলিস্টে পাঠানো হয়েছে', description: 'পণ্যটি কার্ট থেকে সরিয়ে উইশলিস্টে রাখা হয়েছে' });
  };

  const showSkeleton = !hydrated;

  if (showSkeleton) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <ShoppingBag className="h-9 w-9 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">আপনার কার্ট খালি</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            এখনো কোনো পণ্য কার্টে যোগ করেননি। আমাদের বিভিন্ন ব্র্যান্ডের পণ্যগুলো দেখুন।
          </p>
          <Button className="mt-6" onClick={() => navigate({ name: 'shop' })}>
            কেনাকাটা শুরু করুন <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <SectionHeader title={`শপিং কার্ট (${toBn(count)} টি পণ্য)`} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="space-y-3 lg:col-span-2">
          {items.map((it) => {
            const vLabel = [it.variant?.color, it.variant?.size].filter(Boolean).join(', ');
            const maxStock = it.variant ? it.variant.stock : it.product.stock;
            return (
              <div key={`${it.productId}-${it.variantKey}`} className="flex gap-4 rounded-xl border bg-card p-4">
                <button
                  onClick={() => navigate({ name: 'product', slug: it.product.slug })}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted sm:h-28 sm:w-28"
                  aria-label={it.product.nameBn || it.product.name}
                >
                  <CartImage src={it.image} alt={it.product.nameBn || it.product.name} />
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        onClick={() => navigate({ name: 'product', slug: it.product.slug })}
                        className="line-clamp-2 text-left text-sm font-semibold hover:text-primary sm:text-base"
                      >
                        {it.product.nameBn || it.product.name}
                      </button>
                      {vLabel && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                          {vLabel}
                        </div>
                      )}
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {it.product.unit} · স্টকে {toBn(maxStock)} টি
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => sendToWishlist(it.productId, it.variantKey || '')}
                        aria-label="উইশলিস্টে পাঠান"
                        title="উইশলিস্টে পাঠান"
                      >
                        <Heart className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          removeItem(it.productId, it.variantKey || '');
                          toast({ title: 'পণ্য সরানো হয়েছে' });
                        }}
                        aria-label="মুছে ফেলুন"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex items-center overflow-hidden rounded-lg border">
                      <button
                        onClick={() => updateItem(it.productId, it.quantity - 1, it.variantKey || '')}
                        className="flex h-9 w-9 items-center justify-center hover:bg-accent"
                        aria-label="কমান"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-bold">{toBn(it.quantity)}</span>
                      <button
                        onClick={() => updateItem(it.productId, Math.min(it.quantity + 1, maxStock), it.variantKey || '')}
                        className="flex h-9 w-9 items-center justify-center hover:bg-accent disabled:opacity-40"
                        disabled={it.quantity >= maxStock}
                        aria-label="বাড়ান"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-primary sm:text-lg">
                        {formatBDT(it.lineTotal)}
                      </div>
                      {it.quantity > 1 && (
                        <div className="text-xs text-muted-foreground">{formatBDT(it.unitPrice)} × {toBn(it.quantity)}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-32">
          <h3 className="font-bold">অর্ডার সামারি</h3>

          {/* Coupon */}
          <div className="mt-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium" htmlFor="cart-coupon">
              <Tag className="h-3.5 w-3.5" /> কুপন কোড
            </label>
            {coupon ? (
              <div className="flex items-center justify-between rounded-lg bg-green-50 p-2.5 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                <span>
                  <BiIcon name="bi-check2" className="mr-0.5 inline align-[-2px]" /> {coupon.coupon.code} প্রয়োগ হয়েছে
                  {coupon.discount > 0 ? ` (-${formatBDT(coupon.discount)})` : ' — ফ্রি ডেলিভারি'}
                </span>
                <button onClick={removeCoupon} aria-label="কুপন বাদ দিন">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="cart-coupon"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  placeholder="যেমন: SHOP10"
                  aria-label="কুপন কোড"
                />
                <Button variant="secondary" onClick={applyCoupon} disabled={couponLoading}>
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'প্রয়োগ'}
                </Button>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">সাবটোটাল</span>
              <span className="font-medium">{formatBDT(subtotal)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>কুপন ছাড়</span>
                <span className="font-medium">−{formatBDT(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">ডেলিভারি চার্জ (প্রাক্কলন)</span>
              <span className="font-medium">
                {shippingEstimate === 0 ? <span className="text-green-600">ফ্রি</span> : formatBDT(shippingEstimate)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-base">
              <span className="font-bold">সর্বমোট</span>
              <span className="font-extrabold text-primary">{formatBDT(total)}</span>
            </div>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            <BiIcon name="bi-info-circle" className="mr-1 inline align-[-2px]" />
            চেকআউটে সঠিক ডেলিভারি চার্জ হিসাব হবে
          </p>

          <Button
            size="lg"
            className="mt-5 w-full font-semibold"
            onClick={() => navigate({ name: 'checkout' })}
          >
            চেকআউট করুন <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate({ name: 'shop' })}>
            আরও কেনাকাটা করুন
          </Button>
        </div>
      </div>
    </div>
  );
}

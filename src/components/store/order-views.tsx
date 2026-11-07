'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, Package, Truck, Search, Loader2, Phone, Printer, MapPin,
  RotateCcw, XCircle, Repeat2, AlertTriangle, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { useCollection } from '@/lib/db/hooks';
import { trackPurchase } from '@/lib/analytics';
import {
  orderByNumber, trackOrder, reorder, requestReturn,
} from '@/lib/db/services';
import { db } from '@/lib/db/core';
import { fileToDataUrl } from '@/lib/db/image-tools';
import { isGithubConfigured, uploadDataUrlToGithub } from '@/lib/db/github';
import type { Order } from '@/lib/db/types';
import {
  formatBDT, toBn, formatBnDate, ORDER_STATUS_BN, ORDER_STATUS_COLOR, TRACKING_FLOW,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const PAYMENT_STATUS_BN: Record<string, string> = {
  PENDING: 'অপরিশোধিত',
  PAID: 'পরিশোধিত',
  FAILED: 'পেমেন্ট ব্যর্থ',
  REFUNDED: 'রিফান্ড সম্পন্ন',
  PARTIALLY_REFUNDED: 'আংশিক রিফান্ড',
};

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  REFUNDED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
  PARTIALLY_REFUNDED: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
};

const RETURN_REASONS = [
  'ভুল পণ্য পাঠানো হয়েছে',
  'পণ্য ত্রুটিপূর্ণ',
  'পছন্দ পরিবর্তন',
  'অন্যান্য',
];

/** কুরিয়ার ট্র্যাকিং লিংক তৈরি */
function courierTrackingUrl(order: Order): string | null {
  if (!order.courierName || !order.trackingNumber) return null;
  const courier = db.collection('couriers').find((c) => c.name === order.courierName || c.nameBn === order.courierName);
  if (!courier?.trackingUrl) return null;
  return courier.trackingUrl.replace('{tracking}', order.trackingNumber);
}

// ═══════════════════════ ইনভয়েস প্রিন্ট ═══════════════════════

/** লুকানো ইনভয়েস — window.print()-এ শুধু এই অংশ প্রিন্ট হয় */
function InvoicePrint({ order }: { order: Order }) {
  const siteSettings = useStore((s) => s.siteSettings);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
@media print {
  body * { visibility: hidden !important; }
  #tsb-invoice-print, #tsb-invoice-print * { visibility: visible !important; }
  #tsb-invoice-print {
    display: block !important;
    position: absolute !important;
    left: 0 !important; top: 0 !important;
    width: 100% !important;
    padding: 24px !important;
    color: #000 !important;
    background: #fff !important;
  }
}
` }} />
      <div id="tsb-invoice-print" className="hidden print:block">
        <div className="flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <h1 className="text-2xl font-bold">{siteSettings.site_title || 'THE SHOP BD'}</h1>
            <p className="text-xs">{siteSettings.site_tagline || 'মাল্টিব্র্যান্ড অনলাইন শপ'}</p>
            <p className="text-xs">{siteSettings.contact_phone}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">ইনভয়েস</div>
            <div className="text-sm">অর্ডার: {order.orderNumber}</div>
            <div className="text-xs">তারিখ: {formatBnDate(order.createdAt)}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-bold">গ্রাহকের তথ্য</div>
            <div>{order.customerName}</div>
            <div>{order.phone}</div>
            <div>{order.address}</div>
            <div>{[order.area, order.city, order.district].filter(Boolean).join(', ')}</div>
          </div>
          <div>
            <div className="font-bold">পেমেন্ট</div>
            <div>মেথড: {order.paymentMethodName}</div>
            <div>স্ট্যাটাস: {PAYMENT_STATUS_BN[order.paymentStatus] || order.paymentStatus}</div>
            {order.transaction?.trxId && <div>TrxID: {order.transaction.trxId}</div>}
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y bg-neutral-100 text-left">
              <th className="p-2">পণ্য</th>
              <th className="p-2 text-center">পরিমাণ</th>
              <th className="p-2 text-right">দাম</th>
              <th className="p-2 text-right">মোট</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="p-2">
                  {it.productName}
                  {it.variantName ? ` (${it.variantName})` : ''}
                </td>
                <td className="p-2 text-center">{toBn(it.quantity)}</td>
                <td className="p-2 text-right">{formatBDT(it.price)}</td>
                <td className="p-2 text-right">{formatBDT(it.price * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="p-2" colSpan={3}>সাবটোটাল</td>
              <td className="p-2 text-right">{formatBDT(order.subtotal)}</td>
            </tr>
            {order.discount > 0 && (
              <tr>
                <td className="p-2" colSpan={3}>ছাড়{order.couponCode ? ` (${order.couponCode})` : ''}</td>
                <td className="p-2 text-right">−{formatBDT(order.discount)}</td>
              </tr>
            )}
            <tr>
              <td className="p-2" colSpan={3}>ডেলিভারি চার্জ</td>
              <td className="p-2 text-right">{order.shipping === 0 ? 'ফ্রি' : formatBDT(order.shipping)}</td>
            </tr>
            {!!order.tax && (
              <tr>
                <td className="p-2" colSpan={3}>ভ্যাট/ট্যাক্স</td>
                <td className="p-2 text-right">{formatBDT(order.tax)}</td>
              </tr>
            )}
            <tr className="border-t-2 border-black text-base font-bold">
              <td className="p-2" colSpan={3}>সর্বমোট</td>
              <td className="p-2 text-right">{formatBDT(order.total)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-4 border-t pt-2 text-xs">
          {siteSettings.invoice_note || 'পণ্য গ্রহণের ৭ দিনের মধ্যে সমস্যা জানালে রিটার্ন/রিপ্লেসমেন্ট প্রযোজ্য।'}
        </p>
        <p className="mt-1 text-xs">এটি একটি কম্পিউটার জেনারেটেড ইনভয়েস। ধন্যবাদ, {siteSettings.site_title || 'THE SHOP BD'}-এ অর্ডারের জন্য!</p>
      </div>
    </>
  );
}

function printInvoice() {
  try {
    window.print();
  } catch {
    toast({ title: 'প্রিন্ট করা যায়নি', variant: 'destructive' });
  }
}

// ═══════════════════════ ট্র্যাকিং টাইমলাইন ═══════════════════════

function OrderTimeline({ order }: { order: Order }) {
  const statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const histMap = useMemo(() => {
    const m = new Map<string, { at: string; note?: string; by?: string }>();
    for (const e of statusHistory) {
      if (!m.has(e.status)) m.set(e.status, { at: e.at, note: e.note, by: e.by });
    }
    return m;
  }, [statusHistory]);

  const currentIdx = TRACKING_FLOW.indexOf(order.status);
  const isNegative = ['CANCELLED', 'FAILED_DELIVERY', 'RETURNED', 'REFUNDED'].includes(order.status);

  if (isNegative) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <AlertTriangle className="h-4 w-4 text-destructive" /> অর্ডারের অবস্থা
        </h3>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <Badge className={ORDER_STATUS_COLOR[order.status]}>{ORDER_STATUS_BN[order.status] || order.status}</Badge>
          {histMap.get(order.status) && (
            <div className="mt-2 text-xs text-muted-foreground">
              {formatBnDate(histMap.get(order.status)!.at)}
              {histMap.get(order.status)!.note ? ` — ${histMap.get(order.status)!.note}` : ''}
            </div>
          )}
        </div>
        {/* আগে যত ধাপ সম্পন্ন হয়েছিল */}
        <div className="mt-3 space-y-1.5">
          {statusHistory
            .filter((e) => e.status !== order.status)
            .map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                {ORDER_STATUS_BN[e.status] || e.status} — {formatBnDate(e.at)}
                {e.note ? ` — ${e.note}` : ''}
              </div>
            ))}
        </div>
      </div>
    );
  }

  const idx = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-5 flex items-center gap-2 text-sm font-bold">
        <Truck className="h-4 w-4 text-primary" /> ডেলিভারি অবস্থা
      </h3>
      {/* মোবাইলে ৭-ধাপ টাইমলাইন স্ক্রলযোগ্য — ফিক্সড প্রস্থে পেজ ডানে-বামে মুভ বন্ধ।
          ভেতরের relative wrapper-এ min-w-[448px] দেওয়ায় প্রোগ্রেস বারের % হিসাব সঠিক থাকে। */}
      <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative flex min-w-[448px] justify-between">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted" />
          <div
            className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-500"
            style={{ width: `${(idx / (TRACKING_FLOW.length - 1)) * 100}%` }}
          />
          {TRACKING_FLOW.map((step, i) => {
            const done = histMap.has(step) || i < idx;
            const event = histMap.get(step);
            return (
              <div key={step} className="relative z-10 flex shrink-0 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
                    done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted bg-background text-muted-foreground'
                  )}
                >
                  {done ? '✓' : toBn(i + 1)}
                </div>
                <span className={cn(
                  'w-16 text-center text-[10px] leading-tight sm:w-20 sm:text-xs',
                  done ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}>
                  {ORDER_STATUS_BN[step] || step}
                </span>
                {event && (
                  <span className="w-16 text-center text-[9px] leading-tight text-muted-foreground sm:w-20">{formatBnDate(event.at)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ রিটার্ন/বাতিল ডায়ালগ ═══════════════════════

function ReturnRequestDialog({
  order, type, open, onOpenChange,
}: {
  order: Order;
  type: 'return' | 'cancel' | 'replacement';
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [details, setDetails] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const titleBn = type === 'cancel' ? 'বাতিলের অনুরোধ' : type === 'return' ? 'রিটার্ন অনুরোধ' : 'রিপ্লেসমেন্ট অনুরোধ';

  const submit = () => {
    setBusy(true);
    const res = requestReturn({
      orderNumber: order.orderNumber,
      type,
      reason,
      details: details.trim() || undefined,
      proofImage: proof,
    });
    setBusy(false);
    if (res.ok) {
      toast({ title: `${titleBn} জমা হয়েছে`, description: 'আমাদের টিম ২৪-৪৮ ঘণ্টার মধ্যে রিভিউ করবে' });
      setDetails('');
      setProof(null);
      onOpenChange(false);
    } else {
      toast({ title: 'অনুরোধ জমা হয়নি', description: res.error, variant: 'destructive' });
    }
  };

  const pickFile = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, 700, 0.8);
      // GitHub হোস্টিং চালু থাকলে প্রমাণ ছবি রিপোতে উঠে CDN URL হিসেবে সংরক্ষিত হয়
      if (isGithubConfigured()) {
        const up = await uploadDataUrlToGithub(dataUrl, file.name, 'proofs');
        if (up.ok && up.url) {
          setProof(up.url);
          toast({ title: 'প্রমাণ ছবি যোগ হয়েছে' });
          return;
        }
      }
      setProof(dataUrl);
      toast({ title: 'প্রমাণ ছবি যোগ হয়েছে' });
    } catch {
      toast({ title: 'ছবিটি পড়া যায়নি', variant: 'destructive' });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{titleBn}</AlertDialogTitle>
          <AlertDialogDescription>
            অর্ডার {order.orderNumber} — অনুরোধের কারণ জানান। আমাদের টিম ২৪-৪৮ ঘণ্টার মধ্যে রিভিউ করবে।
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-sm">কারণ <span className="text-destructive">*</span></Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">বিস্তারিত (ঐচ্ছিক)</Label>
            <Textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="সমস্যাটি বিস্তারিত লিখুন..."
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">প্রমাণ ছবি (ঐচ্ছিক)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="text-xs"
              />
              {proof && (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border">
                  <img src={proof} alt="প্রমাণ" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>বাতিল</AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            অনুরোধ পাঠান
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ═══════════════════════ অর্ডার সাকসেস ═══════════════════════

export function OrderSuccessView({ orderNumber }: { orderNumber: string }) {
  const navigate = useStore((s) => s.navigate);
  const orders = useCollection('orders');
  const order = useMemo(
    () => orders.find((o) => o.orderNumber.toLowerCase() === orderNumber.toLowerCase()) ?? orderByNumber(orderNumber),
    [orders, orderNumber]
  );

  // GA4 + Facebook Pixel — purchase ইভেন্ট (একবারই)
  const purchaseTracked = useRef<string | null>(null);
  useEffect(() => {
    if (order && purchaseTracked.current !== order.orderNumber) {
      purchaseTracked.current = order.orderNumber;
      trackPurchase(
        order.orderNumber,
        order.total,
        order.items.map((i) => i.productName)
      );
    }
  }, [order]);

  const eta = useMemo(() => {
    if (order?.zoneId) {
      const zone = db.collection('deliveryZones').find((z) => z.id === order.zoneId);
      return zone?.eta ?? null;
    }
    return null;
  }, [order]);

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">অর্ডারের তথ্য লোড হচ্ছে...</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ name: 'home' })}>হোমে ফিরুন</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <InvoicePrint order={order} />

      <div className="rounded-2xl border bg-card p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-extrabold">অর্ডার সফল হয়েছে!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          আপনার অর্ডারের জন্য ধন্যবাদ। আমরা শীঘ্রই আপনাকে ফোনে কনফার্ম করব।
        </p>

        <div className="mx-auto mt-5 w-fit rounded-lg bg-secondary px-5 py-3">
          <div className="text-xs text-muted-foreground">আপনার অর্ডার নম্বর</div>
          <div className="text-xl font-extrabold tracking-wide text-primary">{order.orderNumber}</div>
        </div>

        <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border p-2.5">
            <div className="text-xs text-muted-foreground">মোট পরিশোধ</div>
            <div className="font-bold text-primary">{formatBDT(order.total)}</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-xs text-muted-foreground">পেমেন্ট মেথড</div>
            <div className="truncate font-semibold">{order.paymentMethodName}</div>
          </div>
          {eta && (
            <div className="col-span-2 rounded-lg border p-2.5">
              <div className="text-xs text-muted-foreground">আনুমানিক ডেলিভারি</div>
              <div className="font-semibold">{eta}</div>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          অর্ডার ট্র্যাক করতে এই নম্বরটি সংরক্ষণ করুন
        </p>

        {/* Items */}
        <div className="mt-6 rounded-xl border bg-background/50 p-4 text-left">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
            <Package className="h-4 w-4 text-primary" /> অর্ডারকৃত পণ্য ({toBn(order.items.length)})
          </h3>
          <div className="space-y-2.5">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
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
          <div className="mt-3 space-y-1 border-t pt-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">সাবটোটাল</span><span>{formatBDT(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-green-600"><span>ছাড়</span><span>−{formatBDT(order.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">ডেলিভারি</span><span>{order.shipping === 0 ? 'ফ্রি' : formatBDT(order.shipping)}</span></div>
            {!!order.tax && <div className="flex justify-between"><span className="text-muted-foreground">ভ্যাট/ট্যাক্স</span><span>{formatBDT(order.tax)}</span></div>}
            <div className="flex justify-between text-base font-bold"><span>সর্বমোট</span><span className="text-primary">{formatBDT(order.total)}</span></div>
          </div>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={printInvoice}>
            <Printer className="mr-1.5 h-4 w-4" /> ইনভয়েস প্রিন্ট
          </Button>
          <Button variant="outline" onClick={() => navigate({ name: 'track-order', orderNumber: order.orderNumber })}>
            <Package className="mr-1.5 h-4 w-4" /> অর্ডার ট্র্যাক করুন
          </Button>
          <Button variant="ghost" onClick={() => navigate({ name: 'home' })}>
            শপিং চালিয়ে যান
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ ট্র্যাক অর্ডার ═══════════════════════

const CANCELLABLE = ['PENDING', 'CONFIRMED', 'PROCESSING'];
const RETURNABLE = ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export function TrackOrderView({ orderNumber }: { orderNumber?: string }) {
  const navigate = useStore((s) => s.navigate);
  const siteSettings = useStore((s) => s.siteSettings);
  const hotline = siteSettings.contact_phone || '';
  const [num, setNum] = useState(orderNumber ?? '');
  const [last4, setLast4] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reqType, setReqType] = useState<'return' | 'cancel' | 'replacement' | null>(null);
  const autoRanRef = useRef<string | null>(null);

  const track = (n?: string) => {
    const target = (n ?? num).trim();
    if (!target) {
      toast({ title: 'অর্ডার নম্বর দিন', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setError(null);
    const res = trackOrder(target, last4.trim() ? last4.trim() : undefined);
    setLoading(false);
    if (res.ok && res.order) {
      setOrder(res.order);
      setNum(res.order.orderNumber);
    } else {
      setOrder(null);
      setError(res.error || 'অর্ডার খুঁজে পাওয়া যায়নি');
    }
  };

  // প্রপ দিয়ে এলে অটো-ট্র্যাক (একবার)
  useEffect(() => {
    if (!orderNumber || autoRanRef.current === orderNumber) return;
    autoRanRef.current = orderNumber;
    const t = setTimeout(() => track(orderNumber), 0);
    return () => clearTimeout(t);
  }, [orderNumber]);

  const doReorder = () => {
    if (!order) return;
    const res = reorder(order.orderNumber);
    if (res.ok) {
      toast({ title: 'পণ্যগুলো কার্টে যোগ হয়েছে', description: 'কার্ট দেখে চেকআউট করুন' });
      navigate({ name: 'cart' });
    } else {
      toast({ title: 'রিঅর্ডার সম্ভব হয়নি', description: res.error, variant: 'destructive' });
    }
  };

  const canCancel = order ? CANCELLABLE.includes(order.status) : false;
  const canReturn = order ? RETURNABLE.includes(order.status) : false;
  const trackUrl = order ? courierTrackingUrl(order) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">অর্ডার ট্র্যাক করুন</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          অর্ডার নম্বর দিয়ে আপনার অর্ডারের সর্বশেষ অবস্থা জানুন
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-md rounded-xl border bg-card p-5">
        <div className="space-y-3">
          <Input
            value={num}
            onChange={(e) => setNum(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && track()}
            placeholder="অর্ডার নম্বর (যেমন: TS-260101-1234)"
            aria-label="অর্ডার নম্বর"
          />
          <Input
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => e.key === 'Enter' && track()}
            placeholder="ফোনের শেষ ৪ ডিজিট (ঐচ্ছিক — নিরাপত্তা যাচাই)"
            inputMode="numeric"
            aria-label="ফোনের শেষ ৪ ডিজিট"
          />
          <Button className="w-full font-semibold" onClick={() => track()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            ট্র্যাক করুন
          </Button>
        </div>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      {order && (
        <div className="mt-8 space-y-5">
          {/* মূল কার্ড */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">অর্ডার নম্বর</div>
                <div className="text-lg font-extrabold text-primary">{order.orderNumber}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{formatBnDate(order.createdAt)}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge className={ORDER_STATUS_COLOR[order.status]}>{ORDER_STATUS_BN[order.status] || order.status}</Badge>
                <Badge variant="outline" className={PAYMENT_STATUS_COLOR[order.paymentStatus]}>
                  পেমেন্ট: {PAYMENT_STATUS_BN[order.paymentStatus] || order.paymentStatus}
                </Badge>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">নাম:</span> {order.customerName}</div>
              <div className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {order.phone}</div>
              <div className="sm:col-span-2 flex items-start gap-1">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>{order.address}, {[order.area, order.city, order.district].filter(Boolean).join(', ')}</span>
              </div>
              <div><span className="text-muted-foreground">পেমেন্ট:</span> {order.paymentMethodName}</div>
              {(order.courierName || order.trackingNumber) && (
                <div>
                  <span className="text-muted-foreground">কুরিয়ার:</span> {order.courierName || '—'}
                  {order.trackingNumber && (
                    trackUrl ? (
                      <a href={trackUrl} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-primary underline">
                        {order.trackingNumber}
                      </a>
                    ) : (
                      <span className="ml-1 font-semibold">{order.trackingNumber}</span>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* টাইমলাইন */}
          <OrderTimeline order={order} />

          {/* Items + totals */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-sm font-bold">অর্ডারকৃত পণ্য</h3>
            <div className="space-y-2.5">
              {order.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {it.image ? (
                        <img src={it.image} alt={it.productName} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{it.productName}</div>
                      {it.variantName && (
                        <div className="mt-0.5 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          {it.variantName}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">{toBn(it.quantity)} × {formatBDT(it.price)}</div>
                    </div>
                  </div>
                  <div className="font-bold">{formatBDT(it.price * it.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t pt-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">সাবটোটাল</span><span>{formatBDT(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-green-600"><span>ছাড়</span><span>−{formatBDT(order.discount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">ডেলিভারি</span><span>{order.shipping === 0 ? 'ফ্রি' : formatBDT(order.shipping)}</span></div>
              {!!order.tax && <div className="flex justify-between"><span className="text-muted-foreground">ভ্যাট/ট্যাক্স</span><span>{formatBDT(order.tax)}</span></div>}
              <div className="flex justify-between text-base font-bold"><span>সর্বমোট</span><span className="text-primary">{formatBDT(order.total)}</span></div>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-sm font-bold">এই অর্ডার সম্পর্কে</h3>
            <div className="flex flex-wrap gap-2">
              {canCancel && (
                <Button variant="outline" size="sm" onClick={() => setReqType('cancel')}>
                  <XCircle className="mr-1.5 h-4 w-4 text-destructive" /> বাতিলের অনুরোধ
                </Button>
              )}
              {canReturn && (
                <Button variant="outline" size="sm" onClick={() => setReqType('return')}>
                  <RotateCcw className="mr-1.5 h-4 w-4 text-primary" /> রিটার্ন
                </Button>
              )}
              {canReturn && (
                <Button variant="outline" size="sm" onClick={() => setReqType('replacement')}>
                  <Repeat2 className="mr-1.5 h-4 w-4 text-primary" /> রিপ্লেসমেন্ট
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={doReorder}>
                <Repeat2 className="mr-1.5 h-4 w-4 text-primary" /> আবার অর্ডার করুন
              </Button>
              <Button variant="outline" size="sm" onClick={printInvoice}>
                <Printer className="mr-1.5 h-4 w-4" /> ইনভয়েস প্রিন্ট
              </Button>
            </div>
            {!canCancel && !canReturn && (
              <p className="mt-3 text-xs text-muted-foreground">
                বর্তমান অবস্থায় এই অর্ডার বাতিল বা রিটার্ন করা যাবে না। সহায়তার জন্য হেল্পলাইনে যোগাযোগ করুন।
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" /> {hotline ? `সহায়তার জন্য কল করুন: ${hotline}` : 'সহায়তার জন্য যোগাযোগ পেজ দেখুন'}
          </div>
        </div>
      )}

      {order && reqType && (
        <ReturnRequestDialog
          order={order}
          type={reqType}
          open={!!reqType}
          onOpenChange={(v) => { if (!v) setReqType(null); }}
        />
      )}

      {/* লুকানো ইনভয়েস (প্রিন্টের জন্য) */}
      {order && <InvoicePrint order={order} />}
    </div>
  );
}

/** অ্যাকাউন্ট পেজ থেকেও ব্যবহারের জন্য শেয়ার্ড কম্পোনেন্ট */
export { InvoicePrint, OrderTimeline, ReturnRequestDialog };

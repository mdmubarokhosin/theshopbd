'use client';

/**
 * অ্যাডমিন — অর্ডার ম্যানেজমেন্ট
 * ---------------------------------------------------------------------------
 * • সব অর্ডার: সার্চ/স্ট্যাটাস/পেমেন্ট/তারিখ ফিল্টার + CSV এক্সপোর্ট
 * • অর্ডার ডিটেইলস ডায়ালগ: কাস্টমার, আইটেম, টোটাল, পেমেন্ট, স্ট্যাটাস টাইমলাইন
 * • স্ট্যাটাস ম্যানেজমেন্ট (VALID_TRANSITIONS অনুযায়ী), রিফান্ড, অ্যাডমিন নোট
 * • ইনভয়েস প্রিন্ট
 * • রিটার্ন / বাতিল / রিপ্লেসমেন্ট অনুরোধ রিভিউ
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Search, Eye, Printer, Download, PackageOpen, History, StickyNote,
  Truck, Wallet, MapPin, Phone, CheckCircle2, XCircle, Landmark, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db/core';
import { useCollection, useCurrentUser, useSettings } from '@/lib/db/hooks';
import { can } from '@/lib/db/auth';
import {
  VALID_TRANSITIONS, ORDER_STATUS_BN_FULL, updateOrderStatus,
  reviewReturnRequest, refundOrder, downloadCSV, logAudit, getCurrentUser,
} from '@/lib/db/services';
import { sendToSteadfast } from '@/lib/db/growth';
import type { Order, OrderStatus, ReturnRequest, SiteSettings } from '@/lib/db/types';
import { formatBDT, toBn, formatBnDate, ORDER_STATUSES, ORDER_STATUS_BN, ORDER_STATUS_COLOR } from '@/lib/types';
import { cn } from '@/lib/utils';

// ───────────────────────────── হেল্পার ─────────────────────────────

function formatBnDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

function actorName(): string {
  return getCurrentUser()?.name || 'অ্যাডমিন';
}

const PAY_STATUS_BN: Record<string, string> = {
  PENDING: 'অপেক্ষমাণ',
  PAID: 'পরিশোধিত',
  FAILED: 'ব্যর্থ',
  REFUNDED: 'রিফান্ড সম্পন্ন',
  PARTIALLY_REFUNDED: 'আংশিক রিফান্ড',
};

const PAY_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  REFUNDED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
  PARTIALLY_REFUNDED: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
};

const PAY_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const;

const PAY_TYPE_BN: Record<string, string> = {
  cod: 'ক্যাশ অন ডেলিভারি',
  mobile_banking: 'মোবাইল ব্যাংকিং',
  card: 'কার্ড',
  bank_transfer: 'ব্যাংক ট্রান্সফার',
  bank: 'ব্যাংক',
};

const RETURN_TYPE_BN: Record<ReturnRequest['type'], string> = {
  return: 'রিটার্ন',
  cancel: 'বাতিল',
  replacement: 'রিপ্লেসমেন্ট',
};

const RETURN_TYPE_COLOR: Record<ReturnRequest['type'], string> = {
  return: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  cancel: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  replacement: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
};

const RETURN_STATUS_BN: Record<ReturnRequest['status'], string> = {
  PENDING: 'অপেক্ষমাণ',
  APPROVED: 'অনুমোদিত',
  REJECTED: 'নাকচ করা',
  REFUNDED: 'রিফান্ড সম্পন্ন',
};

const RETURN_STATUS_COLOR: Record<ReturnRequest['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  REFUNDED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold', ORDER_STATUS_COLOR[status] || 'bg-muted')}>
      {ORDER_STATUS_BN[status] || status}
    </span>
  );
}

function PayStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold', PAY_STATUS_COLOR[status] || 'bg-muted')}>
      {PAY_STATUS_BN[status] || status}
    </span>
  );
}

// ───────────────────────────── ইনভয়েস ─────────────────────────────

function InvoiceView({ order, settings }: { order: Order; settings: SiteSettings }) {
  return (
    <div className="space-y-4 text-[13px] leading-relaxed">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-black pb-3">
        <div>
          <div className="text-xl font-extrabold">{settings.site_title || 'THE SHOP BD'}</div>
          <div className="text-xs">{settings.site_tagline}</div>
          <div className="mt-1 text-xs">{settings.contact_address}</div>
          <div className="text-xs">ফোন: {settings.contact_phone} • ইমেইল: {settings.contact_email}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-extrabold">ইনভয়েস</div>
          <div className="text-xs font-bold">#{order.orderNumber}</div>
          <div className="text-xs">{formatBnDateTime(order.createdAt)}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 font-bold">বিল প্রাপক</div>
          <div>{order.customerName}</div>
          <div>{order.phone}</div>
          <div>{order.address}{order.area ? `, ${order.area}` : ''}</div>
          <div>{order.city}, {order.district}</div>
        </div>
        <div className="sm:text-right">
          <div className="mb-1 font-bold">পেমেন্ট</div>
          <div>{order.paymentMethodName} ({PAY_TYPE_BN[order.paymentType] || order.paymentType})</div>
          <div>স্ট্যাটাস: {PAY_STATUS_BN[order.paymentStatus] || order.paymentStatus}</div>
          {order.transaction?.trxId && <div>TrxID: {order.transaction.trxId}</div>}
        </div>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-black bg-black/5 text-left">
            <th className="p-1.5">#</th>
            <th className="p-1.5">পণ্য</th>
            <th className="p-1.5">ভ্যারিয়েন্ট</th>
            <th className="p-1.5 text-center">পরিমাণ</th>
            <th className="p-1.5 text-right">দাম</th>
            <th className="p-1.5 text-right">মোট</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={it.id || i} className="border-b border-black/15">
              <td className="p-1.5">{toBn(i + 1)}</td>
              <td className="p-1.5">{it.productName}</td>
              <td className="p-1.5">{it.variantName || '—'}</td>
              <td className="p-1.5 text-center">{toBn(it.quantity)}</td>
              <td className="p-1.5 text-right">{formatBDT(it.price)}</td>
              <td className="p-1.5 text-right">{formatBDT(it.price * it.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-full max-w-60 space-y-1 text-xs">
        <div className="flex justify-between"><span>সাবটোটাল</span><span>{formatBDT(order.subtotal)}</span></div>
        {order.discount > 0 && <div className="flex justify-between"><span>ছাড়</span><span>−{formatBDT(order.discount)}</span></div>}
        <div className="flex justify-between"><span>ডেলিভারি</span><span>{order.shipping === 0 ? 'ফ্রি' : formatBDT(order.shipping)}</span></div>
        {order.tax ? <div className="flex justify-between"><span>ট্যাক্স</span><span>{formatBDT(order.tax)}</span></div> : null}
        <div className="flex justify-between border-t border-black pt-1 text-sm font-extrabold"><span>সর্বমোট</span><span>{formatBDT(order.total)}</span></div>
      </div>

      {settings.invoice_note && (
        <p className="border-t border-black/20 pt-2 text-center text-[11px]">{settings.invoice_note}</p>
      )}
      <p className="text-center text-[11px] font-semibold">এই ইনভয়েসটি কম্পিউটার দ্বারা তৈরি — ধন্যবাদ {settings.site_title || 'THE SHOP BD'}-এ শপিং করার জন্য!</p>
    </div>
  );
}

// ───────────────────────────── কুইক স্ট্যাটাস সিলেক্ট (ইনলাইন) ─────────────────────────────

/** টেবিল রো/মোবাইল কার্ডে কমপ্যাক্ট স্ট্যাটাস পরিবর্তন — শুধু বৈধ ট্রানজিশন দেখায় */
function QuickStatusSelect({ order, onApply }: { order: Order; onApply: (o: Order, next: OrderStatus) => void }) {
  const nexts = VALID_TRANSITIONS[order.status] || [];
  if (nexts.length === 0) return null;
  return (
    <Select
      value={order.status}
      onValueChange={(v) => {
        if (v !== order.status) onApply(order, v as OrderStatus);
      }}
    >
      <SelectTrigger
        className="h-7 w-full gap-1 border-dashed px-2 text-[11px] font-semibold [&>svg]:h-3 [&>svg]:w-3"
        aria-label={`স্ট্যাটাস পরিবর্তন — ${order.orderNumber}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={order.status} disabled className="text-muted-foreground">
          {ORDER_STATUS_BN_FULL[order.status]} — বর্তমান
        </SelectItem>
        {nexts.map((s) => (
          <SelectItem key={s} value={s}>{ORDER_STATUS_BN_FULL[s]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ───────────────────────────── মূল কম্পোনেন্ট ─────────────────────────────

export function AdminOrders({ initialSearch }: { initialSearch?: string } = {}) {
  const { toast } = useToast();
  const ordersRaw = useCollection('orders');
  const returnsRaw = useCollection('returnRequests');
  const couriers = useCollection('couriers');
  const settings = useSettings();
  const { user } = useCurrentUser();

  // ইনলাইন কুইক স্ট্যাটাস চেঞ্জ শুধু orders.edit পারমিশনধারীদের জন্য (RBAC)
  const canEditStatus = !!user && can(user, 'orders.edit');

  // ফিল্টার
  const [search, setSearch] = useState(initialSearch ?? '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [payFilter, setPayFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ডিটেইলস ডায়ালগ
  const [detailId, setDetailId] = useState<string | null>(null);

  // স্ট্যাটাস ম্যানেজমেন্ট
  const [nextStatus, setNextStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [courierId, setCourierId] = useState('');
  const [tracking, setTracking] = useState('');

  // রিফান্ড
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');

  // অ্যাডমিন নোট
  const [adminNoteDraft, setAdminNoteDraft] = useState('');

  // ইনভয়েস প্রিন্ট
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // রিটার্ন রিভিউ
  const [reviewState, setReviewState] = useState<{ req: ReturnRequest; decision: 'APPROVED' | 'REJECTED' | 'REFUNDED' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const orders = useMemo(
    () => [...ordersRaw].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [ordersRaw]
  );

  const returnRequests = useMemo(
    () => [...returnsRaw].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [returnsRaw]
  );

  const pendingReturns = returnRequests.filter((r) => r.status === 'PENDING').length;

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        if (statusFilter !== 'all' && o.status !== statusFilter) return false;
        if (payFilter !== 'all' && o.paymentStatus !== payFilter) return false;
        if (dateFrom && (o.createdAt || '').slice(0, 10) < dateFrom) return false;
        if (dateTo && (o.createdAt || '').slice(0, 10) > dateTo) return false;
        const q = search.trim().toLowerCase();
        if (q) {
          const hay = `${o.orderNumber} ${o.phone} ${o.customerName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [orders, statusFilter, payFilter, dateFrom, dateTo, search]
  );

  const detail = detailId ? orders.find((o) => o.id === detailId) ?? null : null;

  // Steadfast ইন্টিগ্রেশন (চালু থাকলে অর্ডার ডিটেইলে বাটন)
  const steadfastOn = useSettings().sf_enabled === '1';
  const [sfBusy, setSfBusy] = useState(false);
  const sendToSteadfastWithToast = async (order: Order) => {
    setSfBusy(true);
    const res = await sendToSteadfast(order);
    setSfBusy(false);
    if (res.ok) {
      toast({ title: 'Steadfast কনসাইনমেন্ট তৈরি হয়েছে!', description: `ট্র্যাকিং: ${res.trackingCode ?? res.consignmentId ?? '-'}` });
    } else {
      toast({ title: 'Steadfast ব্যর্থ', description: res.error, variant: 'destructive' });
    }
  };

  // প্রিন্ট ফ্লো
  useEffect(() => {
    if (!printOrder) return;
    const t = setTimeout(() => window.print(), 250);
    const done = () => setPrintOrder(null);
    window.addEventListener('afterprint', done);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printOrder]);

  // ডায়ালগ খোলার সময় ফর্ম রিসেট (effect-এ setState না করে এখানেই)
  const openDetail = (id: string) => {
    setNextStatus('');
    setStatusNote('');
    setCourierId('');
    setTracking('');
    setAdminNoteDraft(orders.find((o) => o.id === id)?.adminNote || '');
    setDetailId(id);
  };

  const applyStatus = () => {
    if (!detail || !nextStatus) return;
    const res = updateOrderStatus(detail.id, nextStatus as OrderStatus, {
      note: statusNote.trim() || undefined,
      by: actorName(),
      courierId: nextStatus === 'SHIPPED' && courierId ? courierId : undefined,
      trackingNumber: nextStatus === 'SHIPPED' && tracking.trim() ? tracking.trim() : undefined,
    });
    if (res.ok) {
      toast({ title: `স্ট্যাটাস আপডেট: ${ORDER_STATUS_BN_FULL[nextStatus as OrderStatus]}`, description: detail.orderNumber });
      setNextStatus('');
      setStatusNote('');
      setTracking('');
      setCourierId('');
    } else {
      toast({ title: 'স্ট্যাটাস পরিবর্তন ব্যর্থ', description: res.error, variant: 'destructive' });
    }
  };

  // ইনলাইন কুইক স্ট্যাটাস (টেবিল রো / মোবাইল কার্ড থেকে)
  const quickStatus = (o: Order, next: OrderStatus) => {
    const res = updateOrderStatus(o.id, next, { by: actorName() });
    if (res.ok) {
      toast({ title: `স্ট্যাটাস আপডেট: ${ORDER_STATUS_BN_FULL[next]}`, description: o.orderNumber });
    } else {
      toast({ title: 'স্ট্যাটাস পরিবর্তন ব্যর্থ', description: res.error, variant: 'destructive' });
    }
  };

  const openRefund = () => {
    if (!detail) return;
    const refunded = detail.transaction?.refundedAmount || 0;
    setRefundAmount(String(Math.max(0, detail.total - refunded)));
    setRefundNote('');
    setRefundOpen(true);
  };

  const confirmRefund = () => {
    if (!detail) return;
    const amount = Number(refundAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'সঠিক পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    const res = refundOrder(detail.id, amount, refundNote.trim() || undefined, actorName());
    if (res.ok) {
      toast({ title: 'রিফান্ড সম্পন্ন হয়েছে', description: `${detail.orderNumber} — ${formatBDT(amount)}` });
      setRefundOpen(false);
    } else {
      toast({ title: 'রিফান্ড ব্যর্থ', description: res.error, variant: 'destructive' });
    }
  };

  const saveAdminNote = () => {
    if (!detail) return;
    db.put('orders', { ...detail, adminNote: adminNoteDraft.trim() || null, updatedAt: new Date().toISOString() });
    logAudit({ actor: actorName(), action: 'order.note', entity: 'order', entityId: detail.orderNumber, details: 'অ্যাডমিন নোট সংরক্ষণ' });
    toast({ title: 'অ্যাডমিন নোট সেভ হয়েছে', description: detail.orderNumber });
  };

  const exportCSV = () => {
    if (!filtered.length) {
      toast({ title: 'এক্সপোর্ট করার মতো অর্ডার নেই', variant: 'destructive' });
      return;
    }
    downloadCSV(
      `the-shop-bd-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((o) => ({
        order_number: o.orderNumber,
        date: (o.createdAt || '').slice(0, 10),
        customer: o.customerName,
        phone: o.phone,
        district: o.district,
        city: o.city,
        items: o.items.length,
        subtotal: o.subtotal,
        shipping: o.shipping,
        discount: o.discount,
        tax: o.tax || 0,
        total: o.total,
        payment_method: o.paymentMethodName,
        payment_status: PAY_STATUS_BN[o.paymentStatus] || o.paymentStatus,
        status: ORDER_STATUS_BN_FULL[o.status],
      })),
      {
        order_number: 'অর্ডার নম্বর', date: 'তারিখ', customer: 'কাস্টমার', phone: 'ফোন',
        district: 'জেলা', city: 'শহর', items: 'আইটেম সংখ্যা', subtotal: 'সাবটোটাল',
        shipping: 'ডেলিভারি', discount: 'ছাড়', tax: 'ট্যাক্স', total: 'সর্বমোট',
        payment_method: 'পেমেন্ট মেথড', payment_status: 'পেমেন্ট স্ট্যাটাস', status: 'অর্ডার স্ট্যাটাস',
      }
    );
    toast({ title: 'CSV ডাউনলোড হয়েছে', description: `${toBn(filtered.length)} টি অর্ডার` });
  };

  const confirmReview = () => {
    if (!reviewState) return;
    const res = reviewReturnRequest(reviewState.req.id, reviewState.decision, reviewNote.trim() || undefined);
    if (res.ok) {
      const label =
        reviewState.decision === 'APPROVED' ? 'অনুরোধ অনুমোদিত হয়েছে'
          : reviewState.decision === 'REJECTED' ? 'অনুরোধ নাকচ করা হয়েছে'
            : 'রিফান্ড সম্পন্ন হিসেবে চিহ্নিত হয়েছে';
      toast({ title: label, description: reviewState.req.orderNumber });
    } else {
      toast({ title: 'সমস্যা হয়েছে', description: res.error, variant: 'destructive' });
    }
    setReviewState(null);
    setReviewNote('');
  };

  const allowedNext = detail ? VALID_TRANSITIONS[detail.status] || [] : [];
  const activeCouriers = couriers.filter((c) => c.active);

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: `
@media print {
  body * { visibility: hidden !important; }
  #tsb-invoice-print, #tsb-invoice-print * { visibility: visible !important; }
  #tsb-invoice-print { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border: none !important; }
}
` }} />

      {/* প্রিন্ট ইনভয়েস (শুধু প্রিন্টে দৃশ্যমান) */}
      {printOrder && (
        <div id="tsb-invoice-print" className="fixed left-0 top-0 z-[999] hidden w-full bg-white p-6 text-black print:block" dir="ltr">
          <InvoiceView order={printOrder} settings={settings} />
        </div>
      )}

      <Tabs defaultValue="orders">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">অর্ডার ম্যানেজমেন্ট</h2>
          <TabsList>
            <TabsTrigger value="orders">সব অর্ডার</TabsTrigger>
            <TabsTrigger value="returns" className="gap-1.5">
              রিটার্ন ও বাতিল
              {pendingReturns > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {toBn(pendingReturns)}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════════ সব অর্ডার ═══════════ */}
        <TabsContent value="orders" className="space-y-3">
          {/* টুলবার */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 lg:grid-cols-4">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="অর্ডার নম্বর, ফোন বা নাম..."
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="স্ট্যাটাস" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{ORDER_STATUS_BN[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={payFilter} onValueChange={setPayFilter}>
              <SelectTrigger><SelectValue placeholder="পেমেন্ট" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব পেমেন্ট</SelectItem>
                {PAY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{PAY_STATUS_BN[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="শুরুর তারিখ" className="h-9" />
              <span className="text-xs text-muted-foreground">থেকে</span>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="শেষ তারিখ" className="h-9" />
              <span className="text-xs text-muted-foreground">পর্যন্ত</span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Badge variant="secondary" className="shrink-0">{toBn(filtered.length)} টি অর্ডার</Badge>
              <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5" /> CSV এক্সপোর্ট
              </Button>
            </div>
          </div>

          {/* ডেস্কটপ টেবিল — সংকীর্ণ স্ক্রিনে অনুভূমিক স্ক্রল */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>অর্ডার</TableHead>
                  <TableHead>কাস্টমার</TableHead>
                  <TableHead className="text-center">পণ্য</TableHead>
                  <TableHead className="text-right">সর্বমোট</TableHead>
                  <TableHead>পেমেন্ট</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead>তারিখ</TableHead>
                  <TableHead className="text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      কোনো অর্ডার পাওয়া যায়নি
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => openDetail(o.id)}>
                      <TableCell className="whitespace-nowrap font-mono text-xs font-bold">{o.orderNumber}</TableCell>
                      <TableCell>
                        <div className="max-w-[160px] text-sm font-medium"><span className="block truncate">{o.customerName}</span></div>
                        <div className="text-xs text-muted-foreground">{o.phone}</div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{toBn(o.items.length)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-extrabold text-primary">{formatBDT(o.total)}</TableCell>
                      <TableCell>
                        <div className="max-w-[140px] text-xs font-medium"><span className="block truncate">{o.paymentMethodName}</span></div>
                        <PayStatusBadge status={o.paymentStatus} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={o.status} />
                          {canEditStatus && (
                            <div className="w-36" onClick={(e) => e.stopPropagation()}>
                              <QuickStatusSelect order={o} onApply={quickStatus} />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatBnDate(o.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="বিস্তারিত দেখুন" onClick={(e) => { e.stopPropagation(); openDetail(o.id); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* মোবাইল কার্ড */}
          <div className="space-y-2 md:hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
                <PackageOpen className="mb-2 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">কোনো অর্ডার পাওয়া যায়নি</p>
              </div>
            ) : (
              filtered.map((o) => (
                <div key={o.id} className="rounded-xl border bg-card p-3">
                  <button
                    onClick={() => openDetail(o.id)}
                    className="flex w-full items-center gap-3 text-left transition-colors hover:opacity-90"
                    aria-label={`${o.orderNumber} — বিস্তারিত দেখুন`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-bold">{o.orderNumber}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {o.customerName} • {o.phone} • {formatBnDate(o.createdAt)}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <PayStatusBadge status={o.paymentStatus} />
                        <span className="text-[10px] text-muted-foreground">{o.paymentMethodName}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-extrabold text-primary">{formatBDT(o.total)}</div>
                      <div className="text-[10px] text-muted-foreground">{toBn(o.items.length)} টি পণ্য</div>
                    </div>
                  </button>
                  {canEditStatus && (
                    <div className="mt-2 flex items-center gap-2 border-t pt-2">
                      <span className="shrink-0 text-[11px] text-muted-foreground">স্ট্যাটাস:</span>
                      <QuickStatusSelect order={o} onApply={quickStatus} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ═══════════ রিটার্ন ও বাতিল ═══════════ */}
        <TabsContent value="returns" className="space-y-3">
          {returnRequests.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
              <PackageOpen className="mb-2 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">কোনো রিটার্ন/বাতিলের অনুরোধ নেই</p>
            </div>
          ) : (
            returnRequests.map((r) => (
              <div key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">{r.orderNumber}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', RETURN_TYPE_COLOR[r.type])}>
                    {RETURN_TYPE_BN[r.type]}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', RETURN_STATUS_COLOR[r.status])}>
                    {RETURN_STATUS_BN[r.status]}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatBnDateTime(r.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">কারণ: </span>
                  <span className="font-medium">{r.reason}</span>
                </div>
                {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
                <div className="mt-2 text-xs text-muted-foreground">কাস্টমার: {r.customerName}</div>
                {r.adminNote && (
                  <div className="mt-1 text-xs text-muted-foreground">অ্যাডমিন নোট: {r.adminNote}</div>
                )}
                {r.proofImage && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={r.proofImage}
                      alt="প্রমাণ ছবি"
                      className="h-16 w-16 rounded-lg border object-cover"
                    />
                    <span className="text-[11px] text-muted-foreground">কাস্টমারের দেওয়া প্রমাণ ছবি</span>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === 'PENDING' && (
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => { setReviewState({ req: r, decision: 'APPROVED' }); setReviewNote(''); }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> অনুমোদন
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive hover:bg-destructive/10"
                        onClick={() => { setReviewState({ req: r, decision: 'REJECTED' }); setReviewNote(''); }}
                      >
                        <XCircle className="h-3.5 w-3.5" /> বাতিল
                      </Button>
                    </>
                  )}
                  {r.status === 'APPROVED' && r.type !== 'replacement' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => { setReviewState({ req: r, decision: 'REFUNDED' }); setReviewNote(''); }}
                    >
                      <Wallet className="h-3.5 w-3.5" /> রিফান্ড সম্পন্ন
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════ অর্ডার ডিটেইলস ডায়ালগ ═══════════ */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{detail.orderNumber}</span>
                  <StatusBadge status={detail.status} />
                  <PayStatusBadge status={detail.paymentStatus} />
                </DialogTitle>
                <DialogDescription>
                  অর্ডারের সম্পূর্ণ তথ্য ও স্ট্যাটাস ম্যানেজমেন্ট
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                {/* কাস্টমার তথ্য */}
                <div className="rounded-xl border bg-card p-4 text-sm">
                  <div className="mb-2 text-sm font-bold">কাস্টমার তথ্য</div>
                  <div className="space-y-1.5 text-muted-foreground">
                    <div className="font-medium text-foreground">{detail.customerName}</div>
                    <a href={`tel:${detail.phone}`} className="flex items-center gap-2 hover:text-primary">
                      <Phone className="h-3.5 w-3.5" /> {detail.phone}
                    </a>
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {detail.address}
                        {detail.area ? `, ${detail.area}` : ''}, {detail.city}, {detail.district}
                      </span>
                    </div>
                    {detail.note && (
                      <div className="flex items-start gap-2">
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>কাস্টমার নোট: {detail.note}</span>
                      </div>
                    )}
                    {(detail.courierName || detail.trackingNumber) && (
                      <div className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5" />
                        <span>
                          {detail.courierName ? `${detail.courierName}` : ''}
                          {detail.trackingNumber ? ` • ট্র্যাকিং: ${detail.trackingNumber}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* আইটেম টেবিল */}
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 text-sm font-bold">অর্ডারের পণ্য ({toBn(detail.items.length)})</div>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table className="min-w-[440px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>পণ্য</TableHead>
                          <TableHead>ভ্যারিয়েন্ট</TableHead>
                          <TableHead className="text-center">পরিমাণ</TableHead>
                          <TableHead className="text-right">দাম</TableHead>
                          <TableHead className="text-right">মোট</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.items.map((it) => (
                          <TableRow key={it.id}>
                            <TableCell className="text-sm">{it.productName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{it.variantName || '—'}</TableCell>
                            <TableCell className="text-center text-sm">{toBn(it.quantity)}</TableCell>
                            <TableCell className="text-right text-sm">{formatBDT(it.price)}</TableCell>
                            <TableCell className="text-right text-sm font-bold">{formatBDT(it.price * it.quantity)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* টোটাল */}
                  <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">সাবটোটাল</span><span>{formatBDT(detail.subtotal)}</span></div>
                    {detail.discount > 0 && (
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                        <span>ছাড় {detail.couponCode ? `(${detail.couponCode})` : ''}</span>
                        <span>−{formatBDT(detail.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ডেলিভারি</span>
                      <span>{detail.shipping === 0 ? 'ফ্রি' : formatBDT(detail.shipping)}</span>
                    </div>
                    {detail.tax ? (
                      <div className="flex justify-between"><span className="text-muted-foreground">ট্যাক্স</span><span>{formatBDT(detail.tax)}</span></div>
                    ) : null}
                    <div className="flex justify-between text-base font-extrabold">
                      <span>সর্বমোট</span>
                      <span className="text-primary">{formatBDT(detail.total)}</span>
                    </div>
                  </div>
                </div>

                {/* পেমেন্ট তথ্য */}
                <div className="rounded-xl border bg-card p-4 text-sm">
                  <div className="mb-2 text-sm font-bold">পেমেন্ট তথ্য</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><span className="text-muted-foreground">মেথড: </span>{detail.paymentMethodName}</div>
                    <div><span className="text-muted-foreground">ধরন: </span>{PAY_TYPE_BN[detail.paymentType] || detail.paymentType}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">স্ট্যাটাস: </span>
                      <PayStatusBadge status={detail.paymentStatus} />
                    </div>
                    {detail.transaction?.trxId && (
                      <div><span className="text-muted-foreground">TrxID: </span><span className="font-mono">{detail.transaction.trxId}</span></div>
                    )}
                    {detail.transaction?.senderNumber && (
                      <div><span className="text-muted-foreground">প্রেরকের নম্বর: </span><span className="font-mono">{detail.transaction.senderNumber}</span></div>
                    )}
                  </div>
                </div>

                {/* স্ট্যাটাস টাইমলাইন */}
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <History className="h-4 w-4" /> স্ট্যাটাস ইতিহাস
                  </div>
                  <div className="space-y-0">
                    {[...(Array.isArray(detail.statusHistory) ? detail.statusHistory : [])].reverse().map((ev, i, arr) => (
                      <div key={`${ev.status}-${ev.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < arr.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden="true" />}
                        <span className="mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-primary bg-background" aria-hidden="true" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{ORDER_STATUS_BN_FULL[ev.status] || ev.status}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatBnDateTime(ev.at)}{ev.by ? ` • ${ev.by}` : ''}
                          </div>
                          {ev.note && <div className="mt-0.5 text-xs text-muted-foreground">নোট: {ev.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* স্ট্যাটাস ম্যানেজমেন্ট প্যানেল */}
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-1 text-sm font-bold">স্ট্যাটাস ম্যানেজমেন্ট</div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    বর্তমান স্ট্যাটাস: <span className="font-semibold text-foreground">{ORDER_STATUS_BN_FULL[detail.status]}</span>
                    {' '}— নিচের তালিকা থেকে পরবর্তী বৈধ ধাপ বেছে নিন
                  </p>
                  {allowedNext.length === 0 ? (
                    <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                      এই স্ট্যাটাস চূড়ান্ত — আর কোনো পরিবর্তন সম্ভব নয়।
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>পরবর্তী স্ট্যাটাস</Label>
                          <Select value={nextStatus} onValueChange={setNextStatus}>
                            <SelectTrigger className="mt-1.5"><SelectValue placeholder="বেছে নিন" /></SelectTrigger>
                            <SelectContent>
                              {allowedNext.map((s) => (
                                <SelectItem key={s} value={s}>{ORDER_STATUS_BN_FULL[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>নোট (ঐচ্ছিক)</Label>
                          <Input
                            value={statusNote}
                            onChange={(e) => setStatusNote(e.target.value)}
                            placeholder="যেমন: ফোনে নিশ্চিত করা হয়েছে"
                            className="mt-1.5"
                          />
                        </div>
                      </div>

                      {nextStatus === 'SHIPPED' && (
                        <div className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2">
                          <div>
                            <Label>কুরিয়ার</Label>
                            <Select value={courierId} onValueChange={setCourierId}>
                              <SelectTrigger className="mt-1.5"><SelectValue placeholder="কুরিয়ার বেছে নিন" /></SelectTrigger>
                              <SelectContent>
                                {activeCouriers.length === 0 && (
                                  <SelectItem value="none" disabled>কোনো কুরিয়ার যোগ করা নেই</SelectItem>
                                )}
                                {activeCouriers.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.nameBn || c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>ট্র্যাকিং নম্বর</Label>
                            <Input
                              value={tracking}
                              onChange={(e) => setTracking(e.target.value)}
                              placeholder="যেমন: SF123456789"
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                      )}

                      <Button className="w-full font-semibold sm:w-auto sm:self-start" onClick={applyStatus} disabled={!nextStatus}>
                        স্ট্যাটাস আপডেট করুন
                      </Button>
                    </div>
                  )}
                </div>

                {/* অ্যাডমিন নোট */}
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                    <StickyNote className="h-4 w-4" /> অ্যাডমিন নোট (ইন্টারনাল)
                  </div>
                  <Textarea
                    value={adminNoteDraft}
                    onChange={(e) => setAdminNoteDraft(e.target.value)}
                    rows={2}
                    aria-label="অ্যাডমিন নোট"
                    placeholder="শুধু স্টাফদের জন্য নোট — কাস্টমার দেখবে না"
                  />
                  <Button variant="outline" size="sm" className="mt-2" onClick={saveAdminNote}>
                    নোট সেভ করুন
                  </Button>
                </div>

                {/* অ্যাকশন: ইনভয়েস + রিফান্ড */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="flex-1 gap-1.5 sm:flex-none" onClick={() => setPrintOrder(detail)}>
                    <Printer className="h-4 w-4" /> ইনভয়েস প্রিন্ট
                  </Button>
                  {steadfastOn && !detail.trackingNumber && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-1.5 border-primary/50 text-primary sm:flex-none"
                      onClick={() => void sendToSteadfastWithToast(detail)}
                      disabled={sfBusy}
                    >
                      {sfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
                      Steadfast-এ পাঠান
                    </Button>
                  )}
                  {(detail.paymentStatus === 'PAID' || detail.paymentStatus === 'PARTIALLY_REFUNDED') && (
                    <Button variant="destructive" className="flex-1 gap-1.5 sm:flex-none" onClick={openRefund}>
                      <Wallet className="h-4 w-4" /> রিফান্ড
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* রিফান্ড ডায়ালগ */}
      <AlertDialog open={refundOpen} onOpenChange={setRefundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>রিফান্ড প্রক্রিয়া করুন</AlertDialogTitle>
            <AlertDialogDescription>
              {detail?.orderNumber} — সর্বমোট {detail ? formatBDT(detail.total) : ''}।
              {detail?.transaction?.refundedAmount ? ` ইতোমধ্যে রিফান্ড: ${formatBDT(detail.transaction.refundedAmount)}।` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>রিফান্ডের পরিমাণ (৳)</Label>
              <Input
                type="number"
                min={1}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">সম্পূর্ণ অর্ডারের দামের কম দিলে আংশিক রিফান্ড হিসেবে গণ্য হবে</p>
            </div>
            <div>
              <Label>নোট (ঐচ্ছিক)</Label>
              <Input value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="যেমন: বিকাশে পাঠানো হয়েছে" className="mt-1.5" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRefund} className="bg-destructive text-white hover:bg-destructive/90">
              রিফান্ড করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* রিটার্ন রিভিউ নোট ডায়ালগ */}
      <AlertDialog open={!!reviewState} onOpenChange={(o) => !o && setReviewState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewState?.decision === 'APPROVED' && 'অনুরোধ অনুমোদন করবেন?'}
              {reviewState?.decision === 'REJECTED' && 'অনুরোধ নাকচ করবেন?'}
              {reviewState?.decision === 'REFUNDED' && 'রিফান্ড সম্পন্ন হিসেবে চিহ্নিত করবেন?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewState && (
                <>
                  {reviewState.req.orderNumber} — {RETURN_TYPE_BN[reviewState.req.type]} অনুরোধ ({RETURN_STATUS_BN[reviewState.req.status]} →{' '}
                  {RETURN_STATUS_BN[reviewState.decision]})।
                  {reviewState.decision === 'APPROVED' && ' অনুমোদন করলে সংশ্লিষ্ট অর্ডারের স্ট্যাটাস স্বয়ংক্রিয়ভাবে আপডেট হবে।'}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label>অ্যাডমিন নোট (ঐচ্ছিক)</Label>
            <Input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="কাস্টমারকে জানানোর মতো সংক্ষিপ্ত নোট" className="mt-1.5" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReview}
              className={reviewState?.decision === 'REJECTED' ? 'bg-destructive text-white hover:bg-destructive/90' : ''}
            >
              নিশ্চিত করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

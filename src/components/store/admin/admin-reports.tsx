'use client';

import { useMemo, useState } from 'react';
import {
  Download, TrendingUp, ShoppingCart, Package, Layers, Users, Boxes, CreditCard,
  Ticket, PiggyBank, Trash2, Plus, CalendarRange,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/lib/db/hooks';
import { customersList, dashboardStats, downloadCSV, addExpense, deleteExpense } from '@/lib/db/services';
import {
  formatBDT, toBn, formatBnDate, ORDER_STATUSES, ORDER_STATUS_BN, ORDER_STATUS_COLOR,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { CategoryBarChart } from './charts';

// ───────────────────────────── হেল্পার ─────────────────────────────

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthDefaults(): { from: string; to: string } {
  const now = new Date();
  return { from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateKey(now) };
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-3 text-center break-words sm:p-4">
      <div className={cn('text-base font-extrabold break-all sm:text-xl', tone === 'good' && 'text-emerald-600', tone === 'bad' && 'text-destructive')}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs font-semibold"
      onClick={() => {
        onClick();
        toast({ title: 'CSV ডাউনলোড হয়েছে' });
      }}
    >
      <Download className="h-3.5 w-3.5" /> CSV
    </Button>
  );
}

const EXPENSE_CATEGORY_BN: Record<string, string> = {
  delivery: 'ডেলিভারি',
  packaging: 'প্যাকেজিং',
  marketing: 'মার্কেটিং',
  gateway_fee: 'গেটওয়ে ফি',
  salary: 'বেতন',
  other: 'অন্যান্য',
};

const COUPON_TYPE_BN: Record<string, string> = {
  percent: 'শতাংশ',
  fixed: 'নির্দিষ্ট টাকা',
  free_shipping: 'ফ্রি শিপিং',
};

// ───────────────────────────── মূল সেকশন ─────────────────────────────

export function AdminReports() {
  const { toast } = useToast();
  const defaults = monthDefaults();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const orders = useCollection('orders');
  const products = useCollection('products');
  const categories = useCollection('categories');
  const transactions = useCollection('transactions');
  const coupons = useCollection('coupons');
  const expenses = useCollection('expenses');
  const users = useCollection('users');

  const stats = useMemo(
    () => dashboardStats(),
    // dashboardStats() ভেতরে categories/returnRequests/reviews/tickets-ও পড়ে —
    // এগুলো বদলালেও রিপোর্ট রি-ক্যালকুলেট হয় যেন স্টেল চার্ট না দেখায়
    [orders, products, expenses, categories, transactions, coupons, users],
  );
  const customers = useMemo(() => customersList(), [users, orders]);

  // তারিখ ইনপুট ফাঁকা/অবৈধ হলে NaN হয় — সেই ফিল্টার সাইড স্কিপ করা হয়
  const fromTime = new Date(`${from}T00:00:00`).getTime();
  const toTime = new Date(`${to}T23:59:59`).getTime();
  const hasFrom = Number.isFinite(fromTime);
  const hasTo = Number.isFinite(toTime);
  const rangeOrders = useMemo(
    () =>
      orders
        .filter((o) => {
          const t = new Date(o.createdAt || '').getTime();
          if (Number.isNaN(t)) return false;
          if (hasFrom && t < fromTime) return false;
          if (hasTo && t > toTime) return false;
          return true;
        })
        .sort((a, b) => ((a.createdAt || '') < (b.createdAt || '') ? 1 : -1)),
    [orders, fromTime, toTime, hasFrom, hasTo],
  );

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.nameBn || c.name])), [categories]);
  // ── ট্যাব ১: বিক্রয় ──
  const validRange = rangeOrders.filter((o) => o.status !== 'CANCELLED');
  const rangeTotal = validRange.reduce((s, o) => s + o.total, 0);
  const avgOrder = validRange.length ? rangeTotal / validRange.length : 0;

  const dailyRows = (() => {
    const map = new Map<string, { orders: number; sales: number }>();
    for (const o of validRange) {
      const key = (o.createdAt || '').slice(0, 10);
      const row = map.get(key) || { orders: 0, sales: 0 };
      row.orders += 1;
      row.sales += o.total;
      map.set(key, row);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  })();

  const exportSales = () => {
    downloadCSV('sales-report.csv', [
      ...dailyRows.map(([day, r]) => ({ তারিখ: day, অর্ডার: r.orders, বিক্রয়: Math.round(r.sales) })),
    ]);
  };

  // ── ট্যাব ২: অর্ডার ──
  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of ORDER_STATUSES) map.set(s, 0);
    for (const o of rangeOrders) map.set(o.status, (map.get(o.status) || 0) + 1);
    return map;
  }, [rangeOrders]);

  const exportOrders = () => {
    downloadCSV(
      'orders-report.csv',
      rangeOrders.map((o) => ({
        'অর্ডার নম্বর': o.orderNumber,
        কাস্টমার: o.customerName,
        ফোন: o.phone,
        স্ট্যাটাস: ORDER_STATUS_BN[o.status] || o.status,
        পেমেন্ট: o.paymentMethodName,
        মোট: Math.round(o.total),
        তারিখ: formatBnDate(o.createdAt),
      })),
    );
  };

  // ── ট্যাব ৩: পণ্য ──
  const topProducts = useMemo(
    () => [...products].sort((a, b) => b.soldCount - a.soldCount).slice(0, 30),
    [products],
  );

  const exportProducts = () => {
    downloadCSV(
      'products-report.csv',
      topProducts.map((p) => ({
        পণ্য: p.nameBn || p.name,
        ক্যাটাগরি: catMap.get(p.categoryId) || '—',
        বিক্রি: p.soldCount,
        স্টক: p.stock,
        আয়: Math.round(p.soldCount * p.price),
      })),
    );
  };

  // ── ট্যাব ৪: ক্যাটাগরি ──
  const exportCategories = () => {
    downloadCSV(
      'category-report.csv',
      stats.categoryPerformance.map((c) => ({ ক্যাটাগরি: c.name, অর্ডার: c.orders, আয়: Math.round(c.revenue) })),
    );
  };

  // ── ট্যাব ৫: কাস্টমার ──
  const exportCustomers = () => {
    downloadCSV(
      'customers-report.csv',
      customers.map((c) => ({
        নাম: c.name,
        ইমেইল: c.email || '',
        ফোন: c.phone || '',
        অর্ডার: c.orderCount,
        'মোট খরচ': Math.round(c.totalSpent),
        যোগদান: formatBnDate(c.createdAt),
      })),
    );
  };

  // ── ট্যাব ৬: ইনভেন্টরি ──
  const inventoryValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  const stockBadge = (stock: number) => {
    if (stock <= 0) return { label: 'স্টক আউট', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' };
    if (stock <= 10) return { label: 'লো স্টক', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
    return { label: 'স্টক ইন', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
  };

  const exportInventory = () => {
    downloadCSV(
      'inventory-report.csv',
      [...products]
        .sort((a, b) => a.stock - b.stock)
        .map((p) => ({
          পণ্য: p.nameBn || p.name,
          SKU: p.sku,
          স্টক: p.stock,
          অবস্থা: stockBadge(p.stock).label,
          'মূল্য (স্টক×দাম)': Math.round(p.stock * p.price),
        })),
    );
  };

  // ── ট্যাব ৭: পেমেন্ট ──
  const txCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) map.set(t.status, (map.get(t.status) || 0) + 1);
    return map;
  }, [transactions]);

  const exportPayments = () => {
    downloadCSV(
      'payment-report.csv',
      stats.paymentBreakdown.map((p) => ({ মেথড: p.method, সংখ্যা: p.count, মোট: Math.round(p.amount) })),
    );
  };

  // ── ট্যাব ৮: কুপন ──
  const exportCoupons = () => {
    downloadCSV(
      'coupon-report.csv',
      coupons.map((c) => ({
        কোড: c.code,
        ধরন: COUPON_TYPE_BN[c.type] || c.type,
        মান: c.value,
        ব্যবহৃত: c.usedCount,
        সীমা: c.usageLimit ?? 'আনলিমিটেড',
        সক্রিয়: c.active ? 'হ্যাঁ' : 'না',
      })),
    );
  };

  // ── ট্যাব ৯: লাভ-ক্ষতি ──
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) || 0) + e.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const estimatedCost = Math.round(stats.totalRevenue * 0.7);

  const exportPnl = () => {
    downloadCSV('profit-loss.csv', [
      { আইটেম: 'মোট আয়', টাকা: Math.round(stats.totalRevenue) },
      { আইটেম: 'আনুমানিক পণ্য কস্ট (৭০%)', টাকা: estimatedCost },
      { আইটেম: 'মোট খরচ', টাকা: Math.round(stats.totalExpenses) },
      { আইটেম: 'গ্রস প্রফিট', টাকা: stats.grossProfit },
      ...expenseByCategory.map(([cat, amount]) => ({ আইটেম: `খরচ — ${EXPENSE_CATEGORY_BN[cat] || cat}`, টাকা: amount })),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">রিপোর্ট ও অ্যানালিটিক্স</h2>
          <p className="text-xs text-muted-foreground">বিক্রয়, অর্ডার, ইনভেন্টরি ও লাভ-ক্ষতির হিসাব</p>
        </div>
        {/* Date range */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
          <Input type="date" value={from} onChange={(e) => { const v = e.target.value; setFrom(v); if (v && to && v > to) setTo(v); }} className="h-8 w-36 text-xs" aria-label="শুরুর তারিখ" />
          <span className="text-xs text-muted-foreground">থেকে</span>
          <Input type="date" value={to} onChange={(e) => { const v = e.target.value; setTo(v); if (v && from && v < from) setFrom(v); }} className="h-8 w-36 text-xs" aria-label="শেষ তারিখ" />
        </div>
      </div>

      <Tabs defaultValue="sales" className="gap-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="sales" className="gap-1.5"><TrendingUp className="h-4 w-4" /> বিক্রয়</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5"><ShoppingCart className="h-4 w-4" /> অর্ডার</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5"><Package className="h-4 w-4" /> পণ্য</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Layers className="h-4 w-4" /> ক্যাটাগরি</TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5"><Users className="h-4 w-4" /> কাস্টমার</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5"><Boxes className="h-4 w-4" /> ইনভেন্টরি</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5"><CreditCard className="h-4 w-4" /> পেমেন্ট</TabsTrigger>
          <TabsTrigger value="coupons" className="gap-1.5"><Ticket className="h-4 w-4" /> কুপন</TabsTrigger>
          <TabsTrigger value="pnl" className="gap-1.5"><PiggyBank className="h-4 w-4" /> লাভ-ক্ষতি</TabsTrigger>
        </TabsList>

        {/* বিক্রয় */}
        <TabsContent value="sales" className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Kpi label="মোট বিক্রয় (নির্বাচিত সময়)" value={formatBDT(rangeTotal)} tone="good" />
            <Kpi label="গড় অর্ডার মূল্য" value={formatBDT(avgOrder)} />
            <Kpi label="অর্ডার সংখ্যা" value={toBn(validRange.length)} />
          </div>
          <div className="flex justify-end"><ExportBtn onClick={exportSales} /></div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">তারিখ</th>
                  <th className="px-4 py-2.5 font-semibold">অর্ডার</th>
                  <th className="px-4 py-2.5 font-semibold">বিক্রয়</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">এই সময়ে কোনো বিক্রয় নেই</td></tr>
                ) : (
                  dailyRows.map(([day, r]) => (
                    <tr key={day} className="border-b last:border-0">
                      <td className="px-4 py-2.5">{formatBnDate(day)}</td>
                      <td className="px-4 py-2.5">{toBn(r.orders)}</td>
                      <td className="px-4 py-2.5 font-semibold">{formatBDT(r.sales)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* অর্ডার */}
        <TabsContent value="orders" className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {ORDER_STATUSES.map((s) => (
              <div key={s} className="rounded-xl border bg-card p-2.5 text-center">
                <Badge className={cn('text-[9px]', ORDER_STATUS_COLOR[s])}>{ORDER_STATUS_BN[s] || s}</Badge>
                <div className="mt-1 text-lg font-extrabold">{toBn(statusCounts.get(s) || 0)}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-end"><ExportBtn onClick={exportOrders} /></div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">অর্ডার</th>
                  <th className="px-4 py-2.5 font-semibold">কাস্টমার</th>
                  <th className="px-4 py-2.5 font-semibold">স্ট্যাটাস</th>
                  <th className="px-4 py-2.5 font-semibold">পেমেন্ট</th>
                  <th className="px-4 py-2.5 font-semibold">মোট</th>
                  <th className="px-4 py-2.5 font-semibold">তারিখ</th>
                </tr>
              </thead>
              <tbody>
                {rangeOrders.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">এই সময়ে কোনো অর্ডার নেই</td></tr>
                ) : (
                  rangeOrders.slice(0, 60).map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold">{o.orderNumber}</td>
                      <td className="px-4 py-2.5">{o.customerName}</td>
                      <td className="px-4 py-2.5"><Badge className={cn('text-[10px]', ORDER_STATUS_COLOR[o.status])}>{ORDER_STATUS_BN[o.status] || o.status}</Badge></td>
                      <td className="px-4 py-2.5 text-xs">{o.paymentMethodName}</td>
                      <td className="px-4 py-2.5 font-semibold">{formatBDT(o.total)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatBnDate(o.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* পণ্য */}
        <TabsContent value="products" className="space-y-3">
          <div className="flex justify-end"><ExportBtn onClick={exportProducts} /></div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">পণ্য</th>
                  <th className="px-4 py-2.5 font-semibold">ক্যাটাগরি</th>
                  <th className="px-4 py-2.5 font-semibold">বিক্রি</th>
                  <th className="px-4 py-2.5 font-semibold">স্টক</th>
                  <th className="px-4 py-2.5 font-semibold">আয়</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{p.nameBn || p.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{catMap.get(p.categoryId) || '—'}</td>
                    <td className="px-4 py-2.5">{toBn(p.soldCount)}</td>
                    <td className="px-4 py-2.5">{toBn(p.stock)}</td>
                    <td className="px-4 py-2.5 font-semibold">{formatBDT(p.soldCount * p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ক্যাটাগরি */}
        <TabsContent value="categories" className="space-y-3">
          <div className="flex justify-end"><ExportBtn onClick={exportCategories} /></div>
          {stats.categoryPerformance.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">কোনো ক্যাটাগরি পারফরম্যান্স ডেটা নেই</p>
          ) : (
            <div className="rounded-xl border bg-card">
              <div className="border-b p-4 text-sm font-semibold">ক্যাটাগরি ভিত্তিক আয় (Chart.js গ্রাফ)</div>
              <div className="h-72 w-full p-4">
                <CategoryBarChart
                  data={stats.categoryPerformance.map((c) => ({ name: c.name, orders: c.orders, revenue: c.revenue }))}
                />
              </div>
            </div>
          )}
        </TabsContent>

        {/* কাস্টমার */}
        <TabsContent value="customers" className="space-y-3">
          <div className="flex justify-end"><ExportBtn onClick={exportCustomers} /></div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">নাম</th>
                  <th className="px-4 py-2.5 font-semibold">যোগাযোগ</th>
                  <th className="px-4 py-2.5 font-semibold">অর্ডার</th>
                  <th className="px-4 py-2.5 font-semibold">মোট খরচ</th>
                  <th className="px-4 py-2.5 font-semibold">যোগদান</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">কোনো কাস্টমার নেই</td></tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{c.name}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.email || c.phone || '—'}</td>
                      <td className="px-4 py-2.5">{toBn(c.orderCount)}</td>
                      <td className="px-4 py-2.5 font-semibold">{formatBDT(c.totalSpent)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatBnDate(c.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ইনভেন্টরি */}
        <TabsContent value="inventory" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="ইনভেন্টরি মূল্য (দাম হিসাবে)" value={formatBDT(inventoryValue)} />
            <Kpi label="আনুমানিক কস্ট ভ্যালু (৭০%)" value={formatBDT(Math.round(inventoryValue * 0.7))} />
          </div>
          <div className="flex justify-end"><ExportBtn onClick={exportInventory} /></div>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">পণ্য</th>
                  <th className="px-4 py-2.5 font-semibold">SKU</th>
                  <th className="px-4 py-2.5 font-semibold">স্টক</th>
                  <th className="px-4 py-2.5 font-semibold">অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {[...products]
                  .sort((a, b) => a.stock - b.stock)
                  .map((p) => {
                    const badge = stockBadge(p.stock);
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5 font-medium">{p.nameBn || p.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.sku}</td>
                        <td className="px-4 py-2.5 font-bold">{toBn(p.stock)}</td>
                        <td className="px-4 py-2.5"><Badge className={cn('text-[10px]', badge.cls)}>{badge.label}</Badge></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* পেমেন্ট */}
        <TabsContent value="payments" className="space-y-3">
          <div className="flex justify-end"><ExportBtn onClick={exportPayments} /></div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">মেথড</th>
                  <th className="px-4 py-2.5 font-semibold">সংখ্যা</th>
                  <th className="px-4 py-2.5 font-semibold">মোট</th>
                </tr>
              </thead>
              <tbody>
                {stats.paymentBreakdown.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">কোনো পেমেন্ট ডেটা নেই</td></tr>
                ) : (
                  stats.paymentBreakdown.map((p) => (
                    <tr key={p.method} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{p.method}</td>
                      <td className="px-4 py-2.5">{toBn(p.count)}</td>
                      <td className="px-4 py-2.5 font-semibold">{formatBDT(p.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-bold">ট্রানজেকশন সামারি ({toBn(transactions.length)})</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ['VERIFIED', 'ভেরিফায়েড', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'],
                ['PENDING', 'অপেক্ষমাণ', 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'],
                ['FAILED', 'ব্যর্থ', 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'],
                ['REFUNDED', 'রিফান্ডেড', 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'],
              ] as const).map(([key, label, cls]) => (
                <div key={key} className="rounded-lg border p-2.5 text-center">
                  <Badge className={cn('text-[9px]', cls)}>{label}</Badge>
                  <div className="mt-1 text-lg font-extrabold">{toBn(txCounts.get(key) || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* কুপন */}
        <TabsContent value="coupons" className="space-y-3">
          <div className="flex justify-end"><ExportBtn onClick={exportCoupons} /></div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">কোড</th>
                  <th className="px-4 py-2.5 font-semibold">ধরন</th>
                  <th className="px-4 py-2.5 font-semibold">ব্যবহৃত</th>
                  <th className="px-4 py-2.5 font-semibold">সীমা</th>
                  <th className="px-4 py-2.5 font-semibold">সক্রিয়</th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">কোনো কুপন নেই</td></tr>
                ) : (
                  coupons.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-mono font-bold">{c.code}</td>
                      <td className="px-4 py-2.5 text-xs">{COUPON_TYPE_BN[c.type] || c.type} {c.type === 'percent' ? `(${toBn(c.value)}%)` : c.type === 'fixed' ? formatBDT(c.value) : ''}</td>
                      <td className="px-4 py-2.5">{toBn(c.usedCount)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.usageLimit ? toBn(c.usageLimit) : 'আনলিমিটেড'}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={c.active ? 'bg-emerald-100 text-emerald-800 text-[10px] dark:bg-emerald-950 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-700 text-[10px] dark:bg-zinc-800 dark:text-zinc-300'}>
                          {c.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* লাভ-ক্ষতি */}
        <TabsContent value="pnl" className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Kpi label="মোট আয়" value={formatBDT(stats.totalRevenue)} tone="good" />
            <Kpi label="আনুমানিক পণ্য কস্ট" value={formatBDT(estimatedCost)} />
            <Kpi label="মোট খরচ" value={formatBDT(stats.totalExpenses)} tone="bad" />
            <Kpi label="গ্রস প্রফিট" value={formatBDT(stats.grossProfit)} tone={stats.grossProfit >= 0 ? 'good' : 'bad'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Expense breakdown + list */}
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold">খরচ ব্রেকডাউন</h3>
                <ExportBtn onClick={exportPnl} />
              </div>
              {expenseByCategory.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">কোনো খরচ এন্ট্রি নেই</p>
              ) : (
                <div className="space-y-1.5">
                  {expenseByCategory.map(([cat, amount]) => (
                    <div key={cat} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      <span className="font-medium">{EXPENSE_CATEGORY_BN[cat] || cat}</span>
                      <span className="font-bold">{formatBDT(amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 max-h-56 space-y-1.5 overflow-y-auto border-t pt-3">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                    <span className="font-medium">{EXPENSE_CATEGORY_BN[e.category] || e.category}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.note || formatBnDate(e.date)}</span>
                    <span className="font-bold">{formatBDT(e.amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => {
                        deleteExpense(e.id);
                        toast({ title: 'খরচ মুছে ফেলা হয়েছে' });
                      }}
                      aria-label="খরচ মুছুন"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick add */}
            <ExpenseQuickAdd />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────────────────── খরচ কুইক-অ্যাড ─────────────────────────────

function ExpenseQuickAdd() {
  const { toast } = useToast();
  const [category, setCategory] = useState('delivery');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(dateKey(new Date()));

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'সঠিক পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    addExpense({ category, amount: Math.round(amt), note: note.trim() || null, date });
    toast({ title: 'খরচ যোগ হয়েছে', description: `${EXPENSE_CATEGORY_BN[category] || category} — ${formatBDT(amt)}` });
    setAmount('');
    setNote('');
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
        <Plus className="h-4 w-4 text-primary" /> খরচ যোগ করুন
      </h3>
      <div className="grid gap-3">
        <div>
          <Label>খরচের খাত</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(EXPENSE_CATEGORY_BN).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>পরিমাণ (৳)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" className="mt-1.5" />
          </div>
          <div>
            <Label>তারিখ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label>নোট (ঐচ্ছিক)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন: কুরিয়ার বিল" className="mt-1.5" />
        </div>
        <Button onClick={submit} className="font-semibold sm:w-44">যোগ করুন</Button>
      </div>
    </div>
  );
}

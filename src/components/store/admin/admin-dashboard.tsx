'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Wallet, CalendarDays, CalendarRange, CalendarCheck, ShoppingCart, Clock, Boxes,
  Truck, CheckCircle2, XCircle, Users, Package, AlertTriangle, PackageX,
  CreditCard, Undo2, Star, LifeBuoy, Receipt, TrendingUp, RefreshCw, ArrowRight,
  Plus, Megaphone, Database,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection } from '@/lib/db/hooks';
import { dashboardStats } from '@/lib/db/services';
import { formatBDT, formatBnDate, toBn, ORDER_STATUS_BN, ORDER_STATUS_COLOR } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SalesLineChart, CategoryBarChart, PaymentDoughnutChart } from './charts';
import type { Section } from './sections';

type KpiCard = {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
};

/** হাইড্রেশন-সেফ mount গেট: সার্ভারে false, ক্লায়েন্টে true */
const emptySubscribe = () => () => {};
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);

const QUICK_ACTIONS: { icon: React.ElementType; label: string; sub: string; go: Section }[] = [
  { icon: Plus, label: 'নতুন পণ্য', sub: 'ক্যাটালগে যোগ করুন', go: 'products' },
  { icon: ShoppingCart, label: 'অর্ডার', sub: 'অর্ডার প্রসেস করুন', go: 'orders' },
  { icon: Megaphone, label: 'মার্কেটিং', sub: 'ফ্ল্যাশ সেল ও প্রোমো', go: 'marketing' },
  { icon: Database, label: 'ব্যাকআপ', sub: 'ডেটা ব্যাকআপ নিন', go: 'system' },
];

export function AdminDashboard({ onNavigate }: { onNavigate?: (s: Section) => void } = {}) {
  const orders = useCollection('orders');
  const products = useCollection('products');
  const users = useCollection('users');
  const reviews = useCollection('reviews');
  const tickets = useCollection('tickets');
  const returnRequests = useCollection('returnRequests');
  const expenses = useCollection('expenses');
  // dashboardStats() ভেতরে categoryPerformance-এর জন্য categories-ও পড়ে — সাবস্ক্রাইব না করলে চার্ট স্টেল থাকে
  const categories = useCollection('categories');
  const [tick, setTick] = useState(0);
  const mounted = useMounted();

  const stats = useMemo(
    () => dashboardStats(),
    [orders, products, users, reviews, tickets, returnRequests, expenses, categories, tick]
  );

  const chartData = useMemo(
    () =>
      stats.salesByDay.map((d) => ({
        label: `${toBn(d.day.slice(8, 10))}/${toBn(String(Number(d.day.slice(5, 7))))}`,
        sales: d.sales,
        orders: d.orders,
        full: d.day,
      })),
    [stats.salesByDay]
  );

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const groups: { title: string; cards: KpiCard[] }[] = [
    {
      title: 'বিক্রয় ও আয়',
      cards: [
        { icon: Wallet, label: 'মোট বিক্রয় (প্রকৃত আয়)', value: formatBDT(stats.totalRevenue), sub: `সম্ভাব্য: ${formatBDT(stats.potentialRevenue)}`, color: 'bg-green-500/10 text-green-600' },
        { icon: CalendarDays, label: 'আজকের বিক্রয়', value: formatBDT(stats.todaySales), sub: `${toBn(stats.todayOrders)} টি অর্ডার`, color: 'bg-primary/10 text-primary' },
        { icon: CalendarRange, label: 'সাপ্তাহিক বিক্রয়', value: formatBDT(stats.weeklySales), sub: 'শেষ ৭ দিন', color: 'bg-purple-500/10 text-purple-600' },
        { icon: CalendarCheck, label: 'মাসিক বিক্রয়', value: formatBDT(stats.monthlySales), sub: `বার্ষিক: ${formatBDT(stats.yearlySales)}`, color: 'bg-orange-500/10 text-orange-600' },
      ],
    },
    {
      title: 'অর্ডার স্ট্যাটাস',
      cards: [
        { icon: ShoppingCart, label: 'মোট অর্ডার', value: toBn(stats.totalOrders), color: 'bg-primary/10 text-primary' },
        { icon: Clock, label: 'পেন্ডিং', value: toBn(stats.pendingOrders), color: 'bg-amber-500/10 text-amber-600' },
        { icon: Boxes, label: 'প্রসেসিং', value: toBn(stats.processingOrders), color: 'bg-teal-500/10 text-teal-600' },
        { icon: Truck, label: 'শিপড', value: toBn(stats.shippedOrders), color: 'bg-violet-500/10 text-violet-600' },
        { icon: CheckCircle2, label: 'ডেলিভারড', value: toBn(stats.deliveredOrders), color: 'bg-emerald-500/10 text-emerald-600' },
        { icon: XCircle, label: 'ক্যান্সেলড', value: toBn(stats.cancelledOrders), color: 'bg-red-500/10 text-red-600' },
      ],
    },
    {
      title: 'কাস্টমার ও পণ্য',
      cards: [
        { icon: Users, label: 'মোট কাস্টমার', value: toBn(stats.totalCustomers), sub: `নতুন (৭ দিন): ${toBn(stats.newCustomers)}`, color: 'bg-green-500/10 text-green-600' },
        { icon: Package, label: 'মোট পণ্য', value: toBn(stats.totalProducts), sub: `সক্রিয়: ${toBn(stats.activeProducts)}`, color: 'bg-teal-500/10 text-teal-600' },
        { icon: AlertTriangle, label: 'লো-স্টক পণ্য', value: toBn(stats.lowStock), sub: 'স্টক ≤ ১০', color: 'bg-amber-500/10 text-amber-600' },
        { icon: PackageX, label: 'আউট-অব-স্টক', value: toBn(stats.outOfStock), sub: 'স্টক = ০', color: 'bg-red-500/10 text-red-600' },
      ],
    },
    {
      title: 'অ্যাকশন প্রয়োজন',
      cards: [
        { icon: CreditCard, label: 'পেন্ডিং পেমেন্ট', value: toBn(stats.pendingPayments), color: 'bg-amber-500/10 text-amber-600' },
        { icon: Undo2, label: 'রিফান্ড রিকোয়েস্ট', value: toBn(stats.refundRequests), sub: `রিটার্ন: ${toBn(stats.returnRequests)}`, color: 'bg-rose-500/10 text-rose-600' },
        { icon: Star, label: 'রিভিউ মডারেশন', value: toBn(stats.pendingReviews), color: 'bg-orange-500/10 text-orange-600' },
        { icon: LifeBuoy, label: 'ওপেন টিকেট', value: toBn(stats.openTickets), color: 'bg-purple-500/10 text-purple-600' },
      ],
    },
    {
      title: 'আর্থিক সারসংক্ষেপ',
      cards: [
        { icon: Receipt, label: 'মোট খরচ', value: formatBDT(stats.totalExpenses), color: 'bg-rose-500/10 text-rose-600' },
        { icon: TrendingUp, label: 'গ্রস প্রফিট', value: formatBDT(stats.grossProfit), sub: 'আয় − ক্রয়মূল্য − খরচ', color: 'bg-emerald-500/10 text-emerald-600' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">ড্যাশবোর্ড</h2>
        <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> রিফ্রেশ
        </Button>
      </div>

      {/* কুইক অ্যাকশন — সবচেয়ে বেশি ব্যবহৃত সেকশনগুলোতে এক ক্লিকে যান */}
      {onNavigate && (
        <nav aria-label="কুইক অ্যাকশন" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Button
              key={a.go}
              variant="outline"
              className="h-auto justify-start gap-2.5 py-2.5"
              onClick={() => onNavigate(a.go)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <a.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold">{a.label}</span>
                <span className="block truncate text-[10px] font-normal text-muted-foreground">{a.sub}</span>
              </span>
            </Button>
          ))}
        </nav>
      )}

      {/* KPI কার্ড গ্রুপ */}
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {g.cards.map((c) => (
              <div key={c.label} className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
                <div className={cn('mb-2 flex h-9 w-9 items-center justify-center rounded-lg', c.color)}>
                  <c.icon className="h-4.5 w-4.5" />
                </div>
                <div className="text-lg font-extrabold leading-tight sm:text-xl">{c.value}</div>
                <div className="truncate text-xs text-muted-foreground">{c.label}</div>
                {c.sub && <div className="mt-0.5 text-[10px] text-muted-foreground/80">{c.sub}</div>}
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* বিক্রয় চার্ট */}
      <section className="rounded-xl border bg-card p-4" aria-label="বিক্রয় চার্ট">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">শেষ ১৪ দিনের বিক্রয় ধারা</h3>
          <p className="text-[11px] text-muted-foreground">রেভেনিউ নোট: প্রকৃত আয় = PAID অর্ডার + COD ডেলিভারড</p>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          মোট অর্ডার এই সময়ে: {toBn(chartData.reduce((s, d) => s + d.orders, 0))} টি
        </p>
        <div className="h-64 w-full">
          <SalesLineChart data={chartData} />
        </div>
      </section>

      {/* টপ প্রোডাক্ট + ক্যাটাগরি পারফরম্যান্স */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card" aria-label="টপ প্রোডাক্ট">
          <h3 className="border-b p-4 text-sm font-bold">সর্বাধিক বিক্রিত পণ্য</h3>
          {stats.topProducts.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">এখনো কোনো বিক্রয় হয়নি</p>
          ) : (
            <div className="divide-y">
              {stats.topProducts.map((p, i) => (
                <div key={`${p.name}-${i}`} className="flex items-center gap-3 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">
                    {toBn(i + 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">বিক্রি: {toBn(p.soldCount)} টি</div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-primary">{formatBDT(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card" aria-label="ক্যাটাগরি পারফরম্যান্স">
          <h3 className="border-b p-4 text-sm font-bold">ক্যাটাগরি পারফরম্যান্স (আয় অনুযায়ী)</h3>
          {stats.categoryPerformance.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">এখনো কোনো অর্ডার নেই</p>
          ) : (
            <div className="h-72 w-full p-4">
              <CategoryBarChart
                data={stats.categoryPerformance.map((c) => ({ name: c.name, orders: c.orders, revenue: c.revenue }))}
              />
            </div>
          )}
        </section>
      </div>

      {/* পেমেন্ট ব্রেকডাউন + সাম্প্রতিক অর্ডার */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card" aria-label="পেমেন্ট ব্রেকডাউন">
          <h3 className="border-b p-4 text-sm font-bold">পেমেন্ট মেথড ব্রেকডাউন</h3>
          {stats.paymentBreakdown.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">এখনো কোনো পেমেন্ট হয়নি</p>
          ) : (
            <div className="grid items-center gap-4 p-4 sm:grid-cols-2">
              <div className="h-56 w-full">
                <PaymentDoughnutChart data={stats.paymentBreakdown} />
              </div>
              <div className="divide-y rounded-lg border">
                {stats.paymentBreakdown.map((m) => (
                  <div key={m.method} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.method}</div>
                      <div className="text-xs text-muted-foreground">{toBn(m.count)} টি অর্ডার</div>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-primary">{formatBDT(m.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card" aria-label="সাম্প্রতিক অর্ডার">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="text-sm font-bold">সাম্প্রতিক অর্ডার</h3>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              সব অর্ডার <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          {stats.recentOrders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">এখনো কোনো অর্ডার নেই</p>
          ) : (
            <div className="divide-y">
              {stats.recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{o.orderNumber}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.customerName} • {formatBnDate(o.createdAt)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-primary">{formatBDT(o.total)}</div>
                    <Badge className={cn('mt-0.5 border-transparent text-[10px]', ORDER_STATUS_COLOR[o.status] || '')}>
                      {ORDER_STATUS_BN[o.status] || o.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

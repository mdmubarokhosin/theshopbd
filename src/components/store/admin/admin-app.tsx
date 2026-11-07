'use client';

/**
 * অ্যাডমিন প্যানেল শেল — নেভিগেশন, RBAC গেটিং ও সেকশন রাউটিং
 * ---------------------------------------------------------------------------
 * • localStorage সেশন (getCurrentUser) — tsb:auth ইভেন্টে রিয়েক্টিভ
 * • রোল-ভিত্তিক পারমিশন: প্রতিটি সেকশন can(user, permission) দিয়ে গেট
 * • পেন্ডিং ব্যাজ: অর্ডার / রিটার্ন / রিভিউ
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Layers, ShoppingCart, Ticket, Star, Mail,
  LogOut, Store, Menu, ShieldCheck, PanelTop, Settings, CreditCard,
  Users, Truck, Megaphone, FileText, UserCog, BarChart3, Database,
  Search, X, PackageOpen, Sparkles, Gift, Inbox, MessageCircle, Radio,
  BellRing, Send, Landmark, Wallet, UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useStore } from '@/lib/store';
import { setNavRouter } from '@/lib/nav';
import { useToast } from '@/hooks/use-toast';
import { formatBDT, toBn } from '@/lib/types';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db/core';
import { useCollection, useCurrentUser, useSettings, notifyAuthChanged } from '@/lib/db/hooks';
import { can, isAdminUser, logout } from '@/lib/db/auth';
import type { Permission } from '@/lib/db/types';
import { AdminGate } from './admin-login';
import { AdminDashboard } from './admin-dashboard';
import { AdminProducts } from './admin-products';
import { AdminCategories } from './admin-categories';
import { AdminBrands } from './admin-brands';
import { AdminOrders } from './admin-orders';
import { AdminPayments } from './admin-payments';
import { AdminCoupons, AdminReviews, AdminSubscribers } from './admin-misc';
import { AdminContent } from './admin-content';
import { AdminSettings } from './admin-settings';
import { AdminCustomers } from './admin-customers';
import { AdminDelivery } from './admin-delivery';
import { AdminMarketing } from './admin-marketing';
import { AdminCms } from './admin-cms';
import { AdminRoles } from './admin-roles';
import { AdminReports } from './admin-reports';
import { AdminSystem } from './admin-system';
import { AdminLoyalty, AdminReferral, AdminAbandoned } from './admin-growth';
import { AdminDeletionRequests } from './admin-deletion';
import {
  AdminWhatsApp, AdminAnalytics, AdminPush, AdminSms, AdminCourier, AdminGateways,
} from './admin-integrations';

import type { Section } from './sections';
export type { Section } from './sections';

type NavItem = { key: Section; label: string; icon: React.ElementType; perm: Permission; group: string };

const NAV: NavItem[] = [
  // ওভারভিউ
  { key: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard, perm: 'dashboard.view', group: 'ওভারভিউ' },
  // ক্যাটালগ
  { key: 'products', label: 'পণ্য', icon: Package, perm: 'products.view', group: 'ক্যাটালগ' },
  { key: 'categories', label: 'ক্যাটাগরি', icon: Layers, perm: 'categories.manage', group: 'ক্যাটালগ' },
  { key: 'brands', label: 'ব্র্যান্ড', icon: Store, perm: 'brands.manage', group: 'ক্যাটালগ' },
  // বিক্রয়
  { key: 'orders', label: 'অর্ডার ও রিটার্ন', icon: ShoppingCart, perm: 'orders.view', group: 'বিক্রয়' },
  { key: 'payments', label: 'পেমেন্ট ম্যানেজমেন্ট', icon: CreditCard, perm: 'payments.view', group: 'বিক্রয়' },
  { key: 'customers', label: 'কাস্টমার', icon: Users, perm: 'customers.view', group: 'বিক্রয়' },
  { key: 'deletion', label: 'ডিলিট রিকোয়েস্ট', icon: UserX, perm: 'customers.manage', group: 'বিক্রয়' },
  // গ্রোথ ও রিটেনশন
  { key: 'loyalty', label: 'লয়ালটি পয়েন্ট', icon: Sparkles, perm: 'customers.manage', group: 'গ্রোথ' },
  { key: 'referral', label: 'রেফারেল কমিশন', icon: Gift, perm: 'marketing.manage', group: 'গ্রোথ' },
  { key: 'abandoned', label: 'অ্যাব্যান্ডন্ড কার্ট', icon: Inbox, perm: 'orders.view', group: 'গ্রোথ' },
  // মার্কেটিং
  { key: 'coupons', label: 'কুপন', icon: Ticket, perm: 'coupons.manage', group: 'মার্কেটিং' },
  { key: 'marketing', label: 'মার্কেটিং টুলস', icon: Megaphone, perm: 'marketing.manage', group: 'মার্কেটিং' },
  { key: 'content', label: 'হোমপেজ কনটেন্ট', icon: PanelTop, perm: 'content.manage', group: 'মার্কেটিং' },
  // ইন্টিগ্রেশন
  { key: 'whatsapp', label: 'WhatsApp অর্ডার', icon: MessageCircle, perm: 'marketing.manage', group: 'ইন্টিগ্রেশন' },
  { key: 'sms', label: 'SMS নোটিফিকেশন', icon: Send, perm: 'settings.manage', group: 'ইন্টিগ্রেশন' },
  { key: 'courier', label: 'কুরিয়ার (Steadfast)', icon: Landmark, perm: 'delivery.manage', group: 'ইন্টিগ্রেশন' },
  { key: 'gateways', label: 'পেমেন্ট গেটওয়ে', icon: Wallet, perm: 'payments.manage', group: 'ইন্টিগ্রেশন' },
  { key: 'analytics', label: 'GA4 ও পিক্সেল', icon: BarChart3, perm: 'settings.manage', group: 'ইন্টিগ্রেশন' },
  { key: 'push', label: 'পুশ নোটিফিকেশন', icon: BellRing, perm: 'settings.manage', group: 'ইন্টিগ্রেশন' },
  // সাপোর্ট
  { key: 'reviews', label: 'রিভিউ মডারেশন', icon: Star, perm: 'content.manage', group: 'সাপোর্ট' },
  { key: 'subscribers', label: 'সাবস্ক্রাইবার', icon: Mail, perm: 'marketing.manage', group: 'সাপোর্ট' },
  // সিস্টেম
  { key: 'delivery', label: 'ডেলিভারি ও স্টক', icon: Truck, perm: 'delivery.manage', group: 'সিস্টেম' },
  { key: 'cms', label: 'পেজ ম্যানেজার (CMS)', icon: FileText, perm: 'cms.manage', group: 'সিস্টেম' },
  { key: 'roles', label: 'রোল ও স্টাফ', icon: UserCog, perm: 'roles.manage', group: 'সিস্টেম' },
  { key: 'reports', label: 'রিপোর্ট ও লাভ-ক্ষতি', icon: BarChart3, perm: 'reports.view', group: 'সিস্টেম' },
  { key: 'settings', label: 'ওয়েবসাইট সেটিংস', icon: Settings, perm: 'settings.manage', group: 'সিস্টেম' },
  { key: 'system', label: 'ব্যাকআপ ও সিস্টেম', icon: Database, perm: 'backup.manage', group: 'সিস্টেম' },
];

const GROUP_LABEL: Record<string, string> = {
  'ওভারভিউ': 'ওভারভিউ',
  'ক্যাটালগ': 'ক্যাটালগ',
  'বিক্রয়': 'বিক্রয় ও কাস্টমার',
  'গ্রোথ': 'গ্রোথ ও রিটেনশন',
  'মার্কেটিং': 'মার্কেটিং ও কনটেন্ট',
  'ইন্টিগ্রেশন': 'ইন্টিগ্রেশন',
  'সাপোর্ট': 'সাপোর্ট',
  'সিস্টেম': 'সিস্টেম ও সেটিংস',
};

export function AdminApp({ initialSection }: { initialSection?: Section }) {
  const navigate = useStore((s) => s.navigate);
  const router = useRouter();
  const { toast } = useToast();
  const { user, ready } = useCurrentUser();
  const siteSettings = useSettings();
  const [section, setSection] = useState<Section>(initialSection ?? 'dashboard');
  const [navOpen, setNavOpen] = useState(false);

  // গ্লোবাল সার্চ (টপ বার, md+)
  const [globalQ, setGlobalQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  // সেকশনে পাঠানো প্রাথমিক সার্চ (গ্লোবাল সার্চ রেজাল্টে ক্লিক করলে)
  const [sectionSearch, setSectionSearch] = useState('');

  // Next router নিবন্ধন — "ওয়েবসাইট দেখুন" ইত্যাদি navigate() কল রিয়েল URL-এ যায়
  useEffect(() => {
    setNavRouter(router);
    return () => setNavRouter(null);
  }, [router]);

  // সেকশন → URL (?section=orders) — প্রতিটি অ্যাডমিন সেকশনের শেয়ারযোগ্য লিংক
  const syncSectionUrl = (s: Section) => {
    const url = s === 'dashboard' ? '/admin' : `/admin?section=${s}`;
    router.replace(url, { scroll: false });
  };

  const authenticated = ready && !!user && isAdminUser(user);

  // পেন্ডিং ব্যাজ কাউন্ট
  const orders = useCollection('orders');
  const productsAll = useCollection('products');
  const returnRequests = useCollection('returnRequests');
  const reviews = useCollection('reviews');
  const deletionRequests = useCollection('deletionRequests');
  const badges = useMemo(() => ({
    orders: orders.filter((o) => o.status === 'PENDING').length,
    returns: returnRequests.filter((r) => r.status === 'PENDING').length,
    reviews: reviews.filter((r) => r.status === 'PENDING').length,
    deletion: deletionRequests.filter((r) => r.status === 'PENDING' || r.status === 'PROCESSING').length,
  }), [orders, returnRequests, reviews, deletionRequests]);

  const allowed = useMemo(() => {
    if (!user) return new Set<Section>();
    return new Set(NAV.filter((n) => can(user, n.perm)).map((n) => n.key));
  }, [user]);

  // পারমিশন হারালে ডেরাইভড ফলব্যাক সেকশন (রেন্ডার-টাইম অ্যাডজাস্ট ছাড়াই)
  const effectiveSection: Section = useMemo(() => {
    if (authenticated && !allowed.has(section)) {
      return allowed.has('dashboard')
        ? 'dashboard'
        : (Array.from(allowed)[0] as Section | undefined) ?? 'dashboard';
    }
    return section;
  }, [authenticated, allowed, section]);

  const doLogout = () => {
    logout();
    notifyAuthChanged();
    toast({ title: 'লগআউট সম্পন্ন', description: 'নিরাপদে লগআউট করা হয়েছে' });
  };

  const goSection = (s: Section, q?: string) => {
    setSection(s);
    setSectionSearch(q ?? '');
    setNavOpen(false);
    syncSectionUrl(s);
    window.scrollTo({ top: 0 });
  };

  // গ্লোবাল সার্চ রেজাল্ট — পণ্য (নাম/SKU) ও অর্ডার (নম্বর/নাম/ফোন) — টপ ৫+৫
  const searchResults = useMemo(() => {
    const q = globalQ.trim().toLowerCase();
    if (q.length < 2) return { products: [], orders: [] };
    const prods = productsAll
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nameBn || '').toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      )
      .slice(0, 5);
    const ords = orders
      .filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          (o.phone || '').includes(q)
      )
      .slice(0, 5);
    return { products: prods, orders: ords };
  }, [globalQ, productsAll, orders]);

  const openSearchResult = (s: Section) => {
    goSection(s, globalQ.trim());
    setGlobalQ('');
    setSearchOpen(false);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <ShieldCheck className="h-10 w-10 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">যাচাই হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    // Firebase-এ অ্যাডমিন না থাকলে রেজিস্ট্রেশন ফর্ম, থাকলে লগইন ফর্ম (AdminGate)
    return <AdminGate onBack={() => navigate({ name: 'home' })} />;
  }

  const groups = Array.from(new Set(NAV.filter((n) => allowed.has(n.key)).map((n) => n.group)));

  const badgeFor = (key: Section): number => {
    if (key === 'orders') return badges.orders + badges.returns;
    if (key === 'reviews') return badges.reviews;
    if (key === 'deletion') return badges.deletion;
    return 0;
  };

  const navList = (
    <nav className="flex flex-col gap-0.5" aria-label="অ্যাডমিন মেনু">
      {groups.map((g) => (
        <div key={g} className={cn(g !== groups[0] && 'mt-2')}>
          {groups.length > 1 && (
            <div className="flex items-center gap-2 px-3 pb-1.5 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {GROUP_LABEL[g] ?? g}
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {NAV.filter((n) => n.group === g && allowed.has(n.key)).map((n) => {
              const badge = badgeFor(n.key);
              const active = section === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => goSection(n.key)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:translate-x-0.5 hover:bg-accent hover:text-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {/* অ্যাকটিভ ইন্ডিকেটর বার */}
                  <span
                    className={cn(
                      'absolute inset-y-1.5 left-0 w-1 rounded-full transition-opacity',
                      active ? 'bg-primary-foreground/80 opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                  <n.icon className={cn('h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-110', active && 'stroke-[2.4]')} />
                  <span className="flex-1 truncate">{n.label}</span>
                  {badge > 0 && (
                    <span className={cn(
                      'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                      active ? 'bg-white/25 text-white' : 'bg-destructive text-white'
                    )}>
                      {toBn(badge)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const sectionLabel = NAV.find((n) => n.key === effectiveSection)?.label ?? '';

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r bg-background p-4 lg:flex scrollbar-thin">
        <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 p-3 text-primary-foreground shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold leading-tight">অ্যাডমিন প্যানেল</div>
            <div className="truncate text-[10px] opacity-80">{siteSettings.site_title || 'THE SHOP BD'}</div>
          </div>
        </div>
        {navList}
        <div className="mt-auto space-y-1 border-t pt-3">
          <div className="mb-1 flex items-center gap-2.5 rounded-xl bg-muted/60 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {(user?.name || '?').trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 text-[11px]">
              <div className="truncate font-semibold text-foreground">{user?.name}</div>
              <div className="truncate text-muted-foreground">{user?.email || user?.phone}</div>
            </div>
          </div>
          <button
            onClick={() => navigate({ name: 'home' })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Store className="h-4.5 w-4.5" /> ওয়েবসাইট দেখুন
          </button>
          <button
            onClick={doLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4.5 w-4.5" /> লগআউট
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top app bar */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="মেনু">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <ShieldCheck className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-extrabold">অ্যাডমিন</span>
            </div>
            <h1 className="ml-2 hidden text-base font-bold lg:block">{sectionLabel}</h1>

            {/* গ্লোবাল সার্চ — ছোট স্ক্রিনে লুকানো (md+) */}
            <div className="relative ml-auto hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalQ}
                onChange={(e) => {
                  setGlobalQ(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setSearchOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchOpen(false);
                }}
                placeholder="পণ্য বা অর্ডার খুঁজুন..."
                className="h-9 w-48 pl-9 pr-8 lg:w-64"
                aria-label="পণ্য বা অর্ডার সার্চ"
              />
              {globalQ && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setGlobalQ('');
                    setSearchOpen(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="সার্চ মুছুন"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {searchOpen && globalQ.trim().length >= 2 && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-popover shadow-lg"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {searchResults.products.length === 0 && searchResults.orders.length === 0 ? (
                    <p className="flex flex-col items-center gap-1 p-5 text-center text-xs text-muted-foreground">
                      <PackageOpen className="h-5 w-5 text-muted-foreground/40" />
                      কিছু পাওয়া যায়নি
                    </p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {searchResults.products.length > 0 && (
                        <div>
                          <div className="bg-muted/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            পণ্য
                          </div>
                          {searchResults.products.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => openSearchResult('products')}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
                            >
                              <Package className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.nameBn || p.name}</span>
                              <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{formatBDT(p.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.orders.length > 0 && (
                        <div className="border-t">
                          <div className="bg-muted/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            অর্ডার
                          </div>
                          {searchResults.orders.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => openSearchResult('orders')}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
                            >
                              <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="min-w-0 flex-1 truncate">
                                <span className="block font-mono text-xs font-bold">{o.orderNumber}</span>
                                <span className="block truncate text-[10px] text-muted-foreground">{o.customerName} • {o.phone}</span>
                              </span>
                              <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{formatBDT(o.total)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1 md:ml-0">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => navigate({ name: 'home' })} aria-label="ওয়েবসাইট দেখুন">
                <Store className="h-4 w-4" /> <span className="hidden sm:inline">ওয়েবসাইট</span>
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={doLogout} aria-label="লগআউট">
                <LogOut className="h-4.5 w-4.5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 lg:pb-8">
          {/* সেকশন বদলালে স্মুথ ট্রানজিশন */}
          <div key={effectiveSection} className="page-enter">
            {effectiveSection === 'dashboard' && <AdminDashboard onNavigate={goSection} />}
            {effectiveSection === 'products' && (
              <AdminProducts key={`ps-${sectionSearch}`} initialSearch={sectionSearch} />
            )}
            {effectiveSection === 'categories' && <AdminCategories />}
            {effectiveSection === 'brands' && <AdminBrands />}
            {effectiveSection === 'orders' && (
              <AdminOrders key={`os-${sectionSearch}`} initialSearch={sectionSearch} />
            )}
            {effectiveSection === 'payments' && <AdminPayments />}
            {effectiveSection === 'customers' && <AdminCustomers />}
            {effectiveSection === 'deletion' && <AdminDeletionRequests />}
            {effectiveSection === 'coupons' && <AdminCoupons />}
            {effectiveSection === 'marketing' && <AdminMarketing onNavigate={goSection} />}
            {effectiveSection === 'reviews' && <AdminReviews />}
            {effectiveSection === 'subscribers' && <AdminSubscribers />}
            {effectiveSection === 'delivery' && <AdminDelivery />}
            {effectiveSection === 'cms' && <AdminCms />}
            {effectiveSection === 'roles' && <AdminRoles />}
            {effectiveSection === 'reports' && <AdminReports />}
            {effectiveSection === 'content' && <AdminContent />}
            {effectiveSection === 'settings' && <AdminSettings />}
            {effectiveSection === 'system' && <AdminSystem />}
            {effectiveSection === 'loyalty' && <AdminLoyalty />}
            {effectiveSection === 'referral' && <AdminReferral />}
            {effectiveSection === 'abandoned' && <AdminAbandoned />}
            {effectiveSection === 'whatsapp' && <AdminWhatsApp />}
            {effectiveSection === 'analytics' && <AdminAnalytics />}
            {effectiveSection === 'push' && <AdminPush />}
            {effectiveSection === 'sms' && <AdminSms />}
            {effectiveSection === 'courier' && <AdminCourier />}
            {effectiveSection === 'gateways' && <AdminGateways />}
          </div>
        </main>
      </div>

      {/* Mobile nav drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="flex w-[86vw] max-w-[320px] flex-col gap-0 overflow-y-auto p-0 scrollbar-thin sm:w-80"
        >
          {/* গ্রেডিয়েন্ট হেডার */}
          <SheetHeader className="rounded-b-none border-b bg-gradient-to-br from-primary to-primary/85 p-4 pb-5 text-primary-foreground">
            <SheetTitle className="flex items-center gap-2.5 text-primary-foreground">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-extrabold leading-tight">অ্যাডমিন প্যানেল</span>
                <span className="block truncate text-[11px] font-normal opacity-80">{siteSettings.site_title || 'THE SHOP BD'}</span>
              </div>
            </SheetTitle>
            <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/10 p-2.5 backdrop-blur">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {(user?.name || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 text-[11px]">
                <div className="truncate font-semibold">{user?.name}</div>
                <div className="truncate opacity-75">{user?.email || user?.phone}</div>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 p-3 pb-2">{navList}</div>
          <div className="sticky bottom-0 mt-auto space-y-1 border-t bg-background/95 p-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => navigate({ name: 'home' })}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Store className="h-4.5 w-4.5" /> ওয়েবসাইট দেখুন
            </button>
            <button
              onClick={doLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4.5 w-4.5" /> লগআউট
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// db ইমপোর্ট ব্যবহার না হলেও রেফারেন্স রাখা হয়েছে (future hooks)
void db;

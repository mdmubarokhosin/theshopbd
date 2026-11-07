'use client';

/**
 * THE SHOP BD — অ্যাপ শেল (URL-ভিত্তিক)
 * ─────────────────────────────────────────────────────────────
 * প্রতিটি রাউট পেজ (src/app/**) সার্ভার কম্পোনেন্ট থেকে view প্রপ পাঠায়।
 * এই শেল সেই view অনুযায়ী Header/View/Footer রেন্ডার করে।
 * navigate() এখন রিয়েল URL তৈরি করে (src/lib/nav.ts) — তাই
 * Domain.com/shop, Domain.com/category/panjabi ইত্যাদি সরাসরি কাজ করে।
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, LayoutGrid, ShoppingCart, Heart, Package, User } from 'lucide-react';
import { Header } from './header';
import { Footer } from './footer';
import { HomeView } from './home-view';
import { ShopView } from './shop-view';
import { SearchView } from './search-view';
import { ProductDetailView } from './product-detail-view';
import { CartView } from './cart-view';
import { CheckoutView } from './checkout-view';
import { OrderSuccessView, TrackOrderView } from './order-views';
import { WishlistView } from './wishlist-view';
import { AuthView } from './auth-view';
import { AccountView } from './account-view';
import { CompareView } from './compare-view';
import { InfoView } from './info-view';
import { AppSplash } from './app-splash';
import { SitePopup } from './site-popup';
import { BroadcastToaster } from './broadcast-toaster';
import { PwaProvider } from './pwa-provider';
import { WhatsAppFloat } from './whatsapp-float';
import { useStore, initClientState } from '@/lib/store';
import { useCart } from '@/lib/use-cart';
import { setNavRouter } from '@/lib/nav';
import { initAnalytics, trackPageView } from '@/lib/analytics';
import { firebaseConfig } from '@/lib/firebase/app';
import { db } from '@/lib/db/core';
import { categoryTree } from '@/lib/db/services';
import { cn } from '@/lib/utils';
import type { Category, View } from '@/lib/types';

function MobileBottomNav() {
  const view = useStore((s) => s.view);
  const navigate = useStore((s) => s.navigate);
  const cartCount = useStore((s) => s.cartCount);
  const wishlist = useStore((s) => s.wishlist);

  const items = [
    { icon: Home, label: 'হোম', active: view.name === 'home', href: '/', action: () => navigate({ name: 'home' }) },
    { icon: LayoutGrid, label: 'শপ', active: view.name === 'shop', href: '/shop', action: () => navigate({ name: 'shop' }) },
    { icon: ShoppingCart, label: 'কার্ট', active: view.name === 'cart', href: '/cart', action: () => navigate({ name: 'cart' }), badge: cartCount },
    { icon: Heart, label: 'উইশলিস্ট', active: view.name === 'wishlist', href: '/wishlist', action: () => navigate({ name: 'wishlist' }), badge: wishlist.length },
    { icon: Package, label: 'ট্র্যাক', active: view.name === 'track-order', href: '/track-order', action: () => navigate({ name: 'track-order' }) },
    {
      icon: User,
      label: 'অ্যাকাউন্ট',
      active: view.name === 'account' || view.name === 'auth',
      href: '/account',
      action: () => navigate({ name: 'account' }),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden safe-bottom" aria-label="মোবাইল নেভিগেশন">
      <div className="grid grid-cols-6">
        {items.map((it) => (
          <a
            key={it.label}
            href={it.href}
            onClick={(e) => {
              e.preventDefault();
              it.action();
            }}
            className={cn(
              'relative flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 text-[10px] font-medium transition-colors press-effect',
              it.active ? 'nav-item-active text-primary' : 'text-muted-foreground'
            )}
          >
            <span className="relative">
              <it.icon className={cn('nav-icon h-5 w-5', it.active && 'stroke-[2.5]')} />
              {!!it.badge && it.badge > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                  {it.badge > 9 ? '৯+' : it.badge}
                </span>
              )}
            </span>
            <span className="w-full truncate text-center leading-none">{it.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

export function AppShell({ view }: { view: View }) {
  const router = useRouter();

  useCart();

  // ক্যাটাগরি — লোকাল সার্ভিস লেয়ার থেকে সিঙ্ক্রোনাসভাবে (fetch নেই)
  const [categories, setCategories] = useState<Category[]>(() => categoryTree());

  useEffect(() => {
    // Next router নিবন্ধন — সব navigate() এখন router.push করে
    setNavRouter(router);
    // উইশলিস্ট + সেটিংস + auth স্টেট হাইড্রেট; DB পরিবর্তনে সিঙ্ক
    initClientState();
    // ক্যাটাগরি রিফ্রেশ (অ্যাডমিন এডিটে)
    const unsub = db.subscribe(() => setCategories(categoryTree()));
    return () => {
      unsub();
      setNavRouter(null);
    };
  }, [router]);

  // বর্তমান view স্টোরে সিঙ্ক — মোবাইল বটম নেভ ও হেডারের অ্যাকটিভ হাইলাইটের জন্য
  useEffect(() => {
    useStore.getState().setView(view);
  }, [view]);

  // অ্যানালিটিক্স (GA4 + FB Pixel) — সেটিংস হাইড্রেট হওয়ার পর প্রথমবার ইনিট
  const siteSettings = useStore((s) => s.siteSettings);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __tsbFirebaseMeasurementId?: string }).__tsbFirebaseMeasurementId =
        firebaseConfig.measurementId || '';
    }
    initAnalytics(siteSettings);
  }, [siteSettings]);

  // পেজ পরিবর্তনে GA4/Pixel page_view
  useEffect(() => {
    trackPageView(window.location.pathname + window.location.search);
  }, [view]);

  // ডায়নামিক ব্র্যান্ড — অ্যাডমিনে সাইটের নাম বদলালে ব্রাউজার ট্যাব টাইটেলও আপডেট হয়
  const siteTitle = useStore((s) => s.siteSettings.site_title);
  useEffect(() => {
    const brand = siteTitle || 'THE SHOP BD';
    if (brand && document.title.includes('THE SHOP BD') && brand !== 'THE SHOP BD') {
      document.title = document.title.replace(/THE SHOP BD/g, brand);
    }
  }, [siteTitle]);

  // হেডারের সার্চবার/আইকন → ডেডিকেটেড সার্চ পেজ (domain.com/search?q=...)
  const handleSearch = (q: string) => {
    useStore.getState().navigate({ name: 'search', q });
  };

  // view → অ্যানিমেশন কী — রাউট/কুয়েরি বদলালে কনটেন্ট স্মুথ ফেড-আপ ট্রানজিশন পায়
  const viewKey = `${view.name}:${(view as Record<string, unknown>).slug ?? ''}:${(view as Record<string, unknown>).category ?? ''}:${(view as Record<string, unknown>).search ?? ''}:${(view as Record<string, unknown>).q ?? ''}:${(view as Record<string, unknown>).tab ?? ''}`;

  return (
    <div className="flex min-h-screen flex-col">
      <AppSplash />
      <PwaProvider />
      <Header categories={categories} onSearch={handleSearch} />
      {/* অ্যাডমিন ব্রডকাস্ট → রিয়েল-টাইম টোস্ট পপআপ */}
      <BroadcastToaster />

      <main className="flex-1 pb-20 md:pb-0">
        <div key={viewKey} className="page-enter">
          {view.name === 'home' && (
            <>
              <HomeView categories={categories} />
              <SitePopup />
            </>
          )}
          {view.name === 'shop' && (
            <ShopView
              key={`${view.category || 'all'}-${view.search || ''}-${view.brand || ''}-${!!view.offers}`}
              categories={categories}
              initialCategory={view.category}
              initialSearch={view.search}
              initialBrand={view.brand}
              offers={view.offers}
            />
          )}
          {view.name === 'search' && <SearchView initialQuery={view.q} />}
          {view.name === 'product' && <ProductDetailView slug={view.slug} />}
          {view.name === 'cart' && <CartView />}
          {view.name === 'checkout' && <CheckoutView />}
          {view.name === 'order-success' && <OrderSuccessView orderNumber={view.orderNumber} />}
          {view.name === 'track-order' && <TrackOrderView orderNumber={view.orderNumber} />}
          {view.name === 'wishlist' && <WishlistView />}
          {view.name === 'compare' && <CompareView />}
          {view.name === 'auth' && <AuthView initialMode={view.mode} />}
          {view.name === 'account' && <AccountView tab={view.tab} />}
          {view.name === 'info' && <InfoView page={view.page} />}
        </div>
      </main>

      <Footer />
      <MobileBottomNav />
      {/* WhatsApp ফ্লোটিং চ্যাট (অ্যাডমিন সেটিংস নিয়ন্ত্রিত) */}
      <WhatsAppFloat hidden={view.name === 'checkout'} />
    </div>
  );
}

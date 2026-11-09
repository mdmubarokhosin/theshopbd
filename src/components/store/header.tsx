'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ShoppingCart, Heart, Phone, Menu, User, Package, ChevronDown, Trash2,
  Bell, LogOut, LogIn, UserPlus, CreditCard, Truck, Tag, Archive, Settings, CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { useStore, initWishlist } from '@/lib/store';
import { useCart } from '@/lib/use-cart';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatBDT, formatBnDate, toBn, variantLabel, type Category, type View } from '@/lib/types';
import { BiIcon, resolveCategoryIcon } from '@/lib/icons';
import { searchSuggestions, announcementItems, notificationsFor, unreadNotificationCount, markNotificationsRead } from '@/lib/db/services';
import { getCurrentUser, logout } from '@/lib/db/auth';
import { notifyAuthChanged, useCollection, useSettings } from '@/lib/db/hooks';
import type { User as DbUser } from '@/lib/db/types';
import { Logo } from './logo';

type HeaderProps = {
  categories: Category[];
  onSearch: (q: string) => void;
};

type Suggestion = { name: string; slug: string; image: string | null; price: number };

/** নোটিফিকেশন টাইপ → আইকন/লেবেল (অ্যাকাউন্ট পেজের ম্যাপের সাথে মিল রেখে) */
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

export function Header({ categories, onSearch }: HeaderProps) {
  const view = useStore((s) => s.view);
  const navigate = useStore((s) => s.navigate);
  const cartCount = useStore((s) => s.cartCount);
  const wishlist = useStore((s) => s.wishlist);
  const mobileMenuOpen = useStore((s) => s.mobileMenuOpen);
  const setMobileMenuOpen = useStore((s) => s.setMobileMenuOpen);
  const siteTitle = useStore((s) => s.siteSettings.site_title) || 'THE SHOP BD';
  const { refresh, items: cartItems, subtotal: cartSubtotal, updateItem, removeItem } = useCart();

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [user, setUser] = useState<DbUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DB ক্যাটাগরি (ডেটাবেস স্টোর থেকে প্রপ আসে, খালি হলে সার্ভিস লেয়ার থেকে)
  const dbCategories = useCollection('categories');
  const cats = categories.length > 0 ? categories : (dbCategories as Category[]);

  // স্লাইডিং ঘোষণা — অ্যাডমিন প্যানেল থেকে নিয়ন্ত্রিত (announcements কালেকশন + মাস্টার সুইচ)
  const dbSettings = useSettings();
  const announcementList = useCollection('announcements');
  const marqueeItems = useMemo(
    () =>
      dbSettings.announcement_enabled !== '1' || !Array.isArray(announcementList)
        ? []
        : [...announcementList]
            .filter((a) => a.enabled && a.text.trim())
            .sort((a, b) => a.sortOrder - b.sortOrder),
    [announcementList, dbSettings.announcement_enabled]
  );

  useEffect(() => {
    initWishlist();
    refresh();
  }, [refresh]);

  // লগইন ইউজার ট্র্যাক (tsb:auth ইভেন্টে রিফ্রেশ)
  useEffect(() => {
    const refreshUser = () => setUser(getCurrentUser());
    refreshUser();
    window.addEventListener('tsb:auth', refreshUser);
    window.addEventListener('storage', refreshUser);
    return () => {
      window.removeEventListener('tsb:auth', refreshUser);
      window.removeEventListener('storage', refreshUser);
    };
  }, []);

  // স্লাইডিং ঘোষণা — উপরে marqueeItems (ডিবি-নিয়ন্ত্রিত) ব্যবহৃত হয়

  // নোটিফিকেশন — ব্রডকাস্ট (userId: null) + নিজের নোটিফিকেশন; ডিবি বদলালে রি-কম্পিউট
  const notifAll = useCollection('notifications');
  const myNotifs = useMemo(
    () => notificationsFor(user?.id ?? null).slice(0, 8),
    [notifAll, user]
  );
  const unreadNotifs = useMemo(
    () => unreadNotificationCount(user?.id ?? null),
    [notifAll, user]
  );

  const handleMarkAllNotifRead = () => {
    markNotificationsRead();
  };

  const openNotif = (id: string) => {
    markNotificationsRead([id]);
    go({ name: 'account', tab: 'notifications' });
  };

  const handleSearchInput = (value: string) => {
    setSearchText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        setSuggestions(searchSuggestions(value.trim(), 8));
        setShowSuggest(true);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggest(false);
    }
  };

  const submitSearch = (q?: string) => {
    const query = (q ?? searchText).trim();
    if (!query) return;
    setShowSuggest(false);
    onSearch(query);
  };

  const go = (v: View) => {
    navigate(v);
    setMobileMenuOpen(false);
    setCartOpen(false);
  };

  const handleLogout = () => {
    logout();
    notifyAuthChanged();
    setUser(null);
    toast({ title: 'লগআউট সম্পন্ন হয়েছে', description: `আবার আসবেন, ${siteTitle} আপনার অপেক্ষায়` });
    go({ name: 'home' });
  };

  const isActive = (name: string) => (view.name === name ? 'text-primary font-semibold' : '');

  return (
    <>
      {/* Top bar — স্লাইডিং ঘোষণা (অ্যাডমিন নিয়ন্ত্রিত); কিছু না থাকলে পুরো বার লুকায় */}
      {marqueeItems.length > 0 && (
      <div className="bg-brand-dark text-primary-foreground">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-xs">
          <div className="relative flex-1 overflow-hidden" aria-live="off">
            <div className="flex w-max animate-marquee whitespace-nowrap">
              {[0, 1].map((group) => (
                <div key={group} aria-hidden={group === 1} className="flex gap-10 pr-10">
                  {marqueeItems.map((a) => {
                    const inner = (
                      <>
                        <BiIcon name={a.icon} className="text-sm" /> {a.text}
                      </>
                    );
                    return a.link ? (
                      <a
                        key={a.id}
                        href={a.link}
                        className="flex items-center gap-1.5 opacity-90 transition-colors hover:text-honey hover:opacity-100"
                      >
                        {inner}
                      </a>
                    ) : (
                      <span key={a.id} className="flex items-center gap-1.5 opacity-90">
                        {inner}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            {dbSettings.contact_phone ? (
              <a href={`tel:${dbSettings.contact_phone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-1.5 hover:text-honey transition-colors">
                <Phone className="h-3 w-3" /> {dbSettings.contact_phone}
              </a>
            ) : null}
            <button onClick={() => go({ name: 'track-order' })} className="flex items-center gap-1.5 hover:text-honey transition-colors">
              <Package className="h-3 w-3" /> অর্ডার ট্র্যাক
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Main header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6">
          {/* Mobile menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="মেনু খুলুন">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined} className="w-80 overflow-y-auto scrollbar-thin">
              <SheetHeader className="border-b pb-3">
                <SheetTitle><Logo /></SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                <button onClick={() => go({ name: 'home' })} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-accent">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base text-primary"><BiIcon name="bi-house-door" /></span>
                  হোম
                </button>
                <button onClick={() => go({ name: 'shop' })} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-accent">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base text-primary"><BiIcon name="bi-grid" /></span>
                  সকল পণ্য
                </button>
                <button onClick={() => go({ name: 'shop', offers: true })} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-accent">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-base"><BiIcon name="bi-fire" /></span>
                  অফার জোন
                </button>
                <button onClick={() => go(user ? { name: 'account' } : { name: 'auth', mode: 'login' })} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-accent">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base text-primary"><BiIcon name="bi-person-circle" /></span>
                  অ্যাকাউন্ট
                </button>
                <button onClick={() => go({ name: 'compare' })} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-accent">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base text-primary"><BiIcon name="bi-columns-gap" /></span>
                  তুলনা করুন
                </button>
                <button onClick={() => go({ name: 'track-order' })} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-accent">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base text-primary"><BiIcon name="bi-box-seam" /></span>
                  অর্ডার ট্র্যাক
                </button>
                <div className="mt-3 border-t pt-3">
                  <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">ক্যাটাগরি</div>
                  {cats.map((c) => (
                    <button key={c.id} onClick={() => go({ name: 'shop', category: c.slug })} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent active:bg-accent">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base">
                        <BiIcon name={resolveCategoryIcon(c.icon)} />
                      </span>
                      <span className="flex-1">{c.nameBn || c.name}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 border-t pt-3">
                  <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">তথ্য</div>
                  <button onClick={() => go({ name: 'info', page: 'about' })} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base text-primary"><BiIcon name="bi-info-circle" /></span>
                    আমাদের সম্পর্কে
                  </button>
                  <button onClick={() => go({ name: 'info', page: 'contact' })} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base text-primary"><BiIcon name="bi-telephone" /></span>
                    যোগাযোগ
                  </button>
                  <button onClick={() => go({ name: 'info', page: 'faq' })} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base text-primary"><BiIcon name="bi-question-circle" /></span>
                    সাধারণ প্রশ্ন
                  </button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          <button onClick={() => go({ name: 'home' })} aria-label={`${siteTitle} হোম`}>
            <Logo />
          </button>

          {/* Search */}
          <div className="relative hidden flex-1 md:block">
            <div className="flex overflow-hidden rounded-lg border-2 border-primary/30 focus-within:border-primary transition-colors">
              <Input
                value={searchText}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                onFocus={() => suggestions.length && setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
                placeholder="পণ্য খুঁজুন... (ইয়ারবাডস, প্যানজাবি, ঘড়ি, জুতা)"
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label="পণ্য সার্চ"
              />
              <Button onClick={() => submitSearch()} className="rounded-none px-5" aria-label="সার্চ করুন">
                <Search className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline text-sm">খুঁজুন</span>
              </Button>
            </div>
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.slug}
                    onMouseDown={() => { go({ name: 'product', slug: s.slug }); setSearchText(''); }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent"
                  >
                    <div className="relative h-10 w-10 overflow-hidden rounded border bg-muted">
                      {/* পণ্যের ছবি data-URL হতে পারে — img ট্যাগ ব্যবহৃত */}
                      <img src={s.image || '/products/tshirt.png'} alt={s.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                    </div>
                    <div className="text-sm font-bold text-primary">{formatBDT(s.price)}</div>
                  </button>
                ))}
                <button
                  onMouseDown={() => submitSearch()}
                  className="w-full bg-accent px-3 py-2 text-center text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  "{searchText}" এর সব ফলাফল দেখুন
                </button>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {/* Mobile search icon — ডেডিকেটেড সার্চ পেজে (/search) নিয়ে যায়, সার্চবার অটো-ফোকাস হয় */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => {
                useStore.getState().bumpSearchFocus();
                go({ name: 'search' });
              }}
              aria-label="সার্চ পেজ"
              title="সার্চ করুন"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Account */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="অ্যাকাউন্ট">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user ? (
                  <>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      <span className="block truncate text-sm font-semibold text-foreground">{user.name}</span>
                      {user.phone || user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => go({ name: 'account' })}>
                      <User className="mr-2 h-4 w-4" /> অ্যাকাউন্ট
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => go({ name: 'account', tab: 'orders' })}>
                      <Package className="mr-2 h-4 w-4" /> আমার অর্ডার
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => go({ name: 'account', tab: 'notifications' })}>
                      <Bell className="mr-2 h-4 w-4" /> নোটিফিকেশন
                      {unreadNotifs > 0 && (
                        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                          {unreadNotifs > 9 ? '৯+' : unreadNotifs}
                        </span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" /> লগআউট
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => go({ name: 'auth', mode: 'login' })}>
                      <LogIn className="mr-2 h-4 w-4" /> লগইন
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => go({ name: 'auth', mode: 'register' })}>
                      <UserPlus className="mr-2 h-4 w-4" /> রেজিস্ট্রেশন
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => go({ name: 'track-order' })}>
                      <Package className="mr-2 h-4 w-4" /> অর্ডার ট্র্যাক
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => go({ name: 'info', page: 'contact' })}>
                      <Phone className="mr-2 h-4 w-4" /> হেল্পলাইন
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* নোটিফিকেশন বেল — ব্রডকাস্ট + নিজের নোটিফিকেশন (সব ডিভাইসে) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label={unreadNotifs > 0 ? `নোটিফিকেশন — ${toBn(unreadNotifs)}টি নতুন` : 'নোটিফিকেশন'}
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifs > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                      {unreadNotifs > 9 ? '৯+' : toBn(unreadNotifs)}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                  <span className="text-sm font-bold">নোটিফিকেশন</span>
                  {unreadNotifs > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotifRead}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> সব পড়া হয়েছে
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                  {myNotifs.length === 0 ? (
                    <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                      কোনো নোটিফিকেশন নেই
                    </p>
                  ) : (
                    myNotifs.map((n) => {
                      const NIcon = NOTIF_ICON[n.type] ?? Bell;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => openNotif(n.id)}
                          className={cn(
                            'flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent',
                            !n.read && 'bg-primary/5'
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                              !n.read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            <NIcon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{n.title}</span>
                              {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" aria-label="নতুন" />}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted-foreground">
                              {n.message}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
                              {formatBnDate(n.createdAt)} • {NOTIF_TYPE_BN[n.type] ?? 'নোটিশ'}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => go({ name: 'account', tab: 'notifications' })}
                  className="w-full border-t bg-accent/40 px-3 py-2.5 text-center text-xs font-semibold text-primary transition-colors hover:bg-accent"
                >
                  সব নোটিফিকেশন দেখুন
                </button>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Wishlist */}
            <Button variant="ghost" size="icon" className="relative" onClick={() => go({ name: 'wishlist' })} aria-label="উইশলিস্ট">
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {wishlist.length}
                </span>
              )}
            </Button>

            {/* Cart */}
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="কার্ট">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent aria-describedby={undefined} className="flex w-full flex-col sm:max-w-md p-0">
                <SheetHeader className="border-b p-4">
                  <SheetTitle className="flex items-center justify-between text-base">
                    শপিং কার্ট ({cartCount} টি পণ্য)
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                  {cartItems.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">আপনার কার্ট খালি</p>
                      <Button size="sm" onClick={() => go({ name: 'shop' })}>কেনাকাটা শুরু করুন</Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {cartItems.map((it) => {
                        const img = it.image;
                        const vLabel = variantLabel(it.variant);
                        return (
                          <div key={`${it.productId}|${it.variantKey || ''}`} className="flex gap-3 rounded-lg border p-2">
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                              {/* পণ্যের ছবি data-URL হতে পারে — img ট্যাগ ব্যবহৃত */}
                              <img src={img || '/products/tshirt.png'} alt={it.product.name} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{it.product.nameBn || it.product.name}</div>
                              {vLabel && (
                                <div className="mt-0.5 text-[11px] font-medium text-primary">{vLabel}</div>
                              )}
                              <div className="mt-1 flex items-center justify-between">
                                <div className="text-sm font-bold text-primary">{formatBDT(it.lineTotal)}</div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline" size="icon" className="h-6 w-6"
                                    onClick={() => updateItem(it.productId, it.quantity - 1, it.variantKey || '')}
                                    aria-label="কমান"
                                  >−</Button>
                                  <span className="w-6 text-center text-xs font-semibold">{it.quantity}</span>
                                  <Button
                                    variant="outline" size="icon" className="h-6 w-6"
                                    onClick={() => updateItem(it.productId, it.quantity + 1, it.variantKey || '')}
                                    aria-label="বাড়ান"
                                  >+</Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                    onClick={() => removeItem(it.productId, it.variantKey || '')}
                                    aria-label="মুছুন"
                                  ><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {cartItems.length > 0 && (
                  <div className="border-t p-4">
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">সাবটোটাল</span>
                      <span className="text-lg font-bold text-primary">{formatBDT(cartSubtotal)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={() => go({ name: 'cart' })}>কার্ট দেখুন</Button>
                      <Button onClick={() => go({ name: 'checkout' })}>চেকআউট</Button>
                    </div>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden border-t bg-secondary/40 lg:block">
          <div className="mx-auto flex h-11 max-w-7xl items-center gap-1 px-4 text-sm">
            {/* All categories dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 font-semibold text-primary">
                  <Menu className="h-4 w-4" /> সকল ক্যাটাগরি <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 max-h-[70vh] overflow-y-auto scrollbar-thin">
                {cats.map((c) => (
                  <div key={c.id}>
                    <DropdownMenuItem onClick={() => go({ name: 'shop', category: c.slug })} className="font-medium cursor-pointer">
                      <BiIcon name={resolveCategoryIcon(c.icon)} className="mr-2 text-base" />
                      {c.nameBn || c.name}
                    </DropdownMenuItem>
                    {c.children && c.children.length > 0 && (
                      <div className="ml-6 border-l">
                        {c.children.map((sc) => (
                          <DropdownMenuItem key={sc.id} onClick={() => go({ name: 'shop', category: sc.slug })} className="text-xs cursor-pointer">
                            <BiIcon name={resolveCategoryIcon(sc.icon)} className="mr-2" />
                            {sc.nameBn || sc.name}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button onClick={() => go({ name: 'home' })} className={cn('rounded-md px-3 py-1.5 hover:text-primary transition-colors', isActive('home'))}>হোম</button>
            <button onClick={() => go({ name: 'shop' })} className={cn('rounded-md px-3 py-1.5 hover:text-primary transition-colors', isActive('shop'))}>সকল পণ্য</button>
            <button onClick={() => go({ name: 'shop', offers: true })} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-destructive hover:bg-destructive/5"><BiIcon name="bi-fire" /> অফার জোন</button>
            <button onClick={() => go({ name: 'shop', category: 'electronics' })} className="rounded-md px-3 py-1.5 hover:text-primary transition-colors">ইলেকট্রনিকস</button>
            <button onClick={() => go({ name: 'shop', category: 'fashion' })} className="rounded-md px-3 py-1.5 hover:text-primary transition-colors">ফ্যাশন</button>
            <button onClick={() => go({ name: 'shop', category: 'mobile-tablet' })} className="rounded-md px-3 py-1.5 hover:text-primary transition-colors">মোবাইল</button>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => go({ name: 'info', page: 'about' })} className="rounded-md px-3 py-1.5 hover:text-primary">আমাদের গল্প</button>
              <button onClick={() => go({ name: 'info', page: 'contact' })} className="rounded-md px-3 py-1.5 hover:text-primary">যোগাযোগ</button>
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}

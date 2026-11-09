'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Star, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from './product-card';
import { useStore } from '@/lib/store';
import { formatBDT, type Category, type Product } from '@/lib/types';
import { BiIcon, resolveCategoryIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import {
  slidesList, sideBannersList, whyUsList, testimonialsList,
  queryProducts, productById,
} from '@/lib/db/services';
import { getRecentlyViewed } from '@/lib/db/auth';
import { useCollection, useDB } from '@/lib/db/hooks';
import type { BannerAction } from '@/lib/db/types';

// সাম্প্রতিক দেখা স্টোর (useSyncExternalStore-বান্ধব — স্থিতিশীল রেফারেন্স)
const EMPTY_RECENT: string[] = [];
function recentSubscribe(cb: () => void) {
  window.addEventListener('tsb:recent', cb);
  return () => window.removeEventListener('tsb:recent', cb);
}

type HomeViewProps = {
  categories: Category[];
};

/* ------------------------------------------------------------------
   Hero — bdeasyshop.com স্টাইল:
   ওপরে ইমেজ স্লাইডার (থিমযুক্ত ব্যানার + কাত করা প্রোডাক্ট ছবি),
   নিচে/পাশে দুইটা অফার ব্যানার।
------------------------------------------------------------------- */

type HeroAction = BannerAction;

type HeroSlide = {
  theme: string;
  store: string;
  title: string;
  tagline: string;
  priceFrom: string;
  discount: string;
  cta: string;
  photos: string[];
  action: HeroAction;
};

type SideBannerItem = {
  theme: string;
  title: string;
  tagline: string;
  cta: string;
  photo: string;
  action: HeroAction;
};

/** সিড ফলব্যাক — DB-তে কোনো স্লাইড না থাকলে এগুলো দেখানো হয় */
const HERO_SLIDES: HeroSlide[] = [
  {
    theme: 'ab-theme-0',
    store: 'THE SHOP BD',
    title: 'প্যানজাবি ও ফ্যাশন',
    tagline: 'নতুন কালেকশন',
    priceFrom: '৳৪৫০',
    discount: '৩২% পর্যন্ত ছাড়',
    cta: 'এখনই কিনুন',
    photos: ['/products/panjabi.png', '/products/shirt.png', '/products/tshirt.png'],
    action: { name: 'shop', category: 'fashion' },
  },
  {
    theme: 'ab-theme-1',
    store: 'THE SHOP BD',
    title: 'ইলেকট্রনিকস',
    tagline: 'লেটেস্ট গ্যাজেট',
    priceFrom: '৳৩৫০',
    discount: '৪৭% পর্যন্ত ছাড়',
    cta: 'এখনই কিনুন',
    photos: ['/products/earbuds.png', '/products/smartwatch.png', '/products/speaker.png'],
    action: { name: 'shop', category: 'electronics' },
  },
  {
    theme: 'ab-theme-2',
    store: 'THE SHOP BD',
    title: 'হোম ও লিভিং',
    tagline: 'ঘর সাজান ভালোবাসায়',
    priceFrom: '৳২৯০',
    discount: '২৬% পর্যন্ত ছাড়',
    cta: 'এখনই কিনুন',
    photos: ['/products/dinner-set.png', '/products/bedsheet.png', '/products/flask.png'],
    action: { name: 'shop', category: 'home-living' },
  },
  {
    theme: 'ab-theme-3',
    store: 'THE SHOP BD',
    title: 'বিউটি ও কেয়ার',
    tagline: 'নিজেকে প্রিয় রাখুন',
    priceFrom: '৳১৯০',
    discount: '৩৮% পর্যন্ত ছাড়',
    cta: 'এখনই কিনুন',
    photos: ['/products/perfume.png', '/products/facewash.png', '/products/cream-jar.png'],
    action: { name: 'shop', category: 'beauty-care' },
  },
];

const SIDE_BANNERS: SideBannerItem[] = [
  {
    theme: 'ab-theme-1',
    title: 'ফ্যাশন ফেস্ট',
    tagline: 'নতুন কালেকশন',
    cta: 'দেখুন',
    photo: '/products/kurti.png',
    action: { name: 'shop', category: 'fashion' },
  },
  {
    theme: 'ab-theme-0',
    title: 'স্পেশাল অফার',
    tagline: 'সীমিত সময়ের ছাড়',
    cta: 'দেখুন',
    photo: '/products/sneakers.png',
    action: { name: 'offers' },
  },
];

/** ব্যানার অ্যাকশন → নেভিগেশন */
function useBannerNavigate() {
  const navigate = useStore((s) => s.navigate);
  return (a: HeroAction) => {
    if (a.name === 'shop') navigate({ name: 'shop', category: a.category || undefined });
    else if (a.name === 'offers') navigate({ name: 'shop', offers: true });
    else if (a.name === 'product' && a.slug) navigate({ name: 'product', slug: a.slug });
    else if (a.name === 'page' && a.page) navigate({ name: 'info', page: a.page });
    else if (a.name === 'url' && a.url) window.open(a.url, '_blank', 'noopener');
  };
}

function BannerContent({
  store,
  title,
  tagline,
  priceFrom,
  discount,
  cta,
  photo,
  photos,
  priority = false,
}: {
  store?: string;
  title: string;
  tagline: string;
  priceFrom?: string;
  discount?: string;
  cta: string;
  photo?: string;
  photos?: string[];
  priority?: boolean;
}) {
  return (
    <>
      <span className="ab-text">
        {store && <span className="ab-store">{store}</span>}
        <span className="ab-title whitespace-pre-line">{title}</span>
        <span className="ab-tagline">{tagline}</span>
        {priceFrom && (
          <span className="ab-price">
            মাত্র <strong>{priceFrom}</strong> থেকে {discount && <em>{discount}</em>}
          </span>
        )}
        <span className="ab-cta">{cta} <BiIcon name="bi-arrow-right" className="align-[-1px]" /></span>
      </span>
      {photos ? (
        <span className="ab-photos n3">
          {photos.map((src, i) => (
            <img key={i} src={src} alt={title} width={300} height={400} loading="eager" fetchPriority={priority && i === 1 ? 'high' : 'auto'} />
          ))}
        </span>
      ) : (
        photo && (
          <span className="ab-photos n1">
            <img src={photo} alt={title} width={300} height={400} loading="lazy" />
          </span>
        )
      )}
    </>
  );
}

function HeroSection({ slides, banners }: { slides: HeroSlide[]; banners: SideBannerItem[] }) {
  const bannerNavigate = useBannerNavigate();
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchXRef = useRef<number | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 5000);
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length]);

  const goTo = (i: number) => {
    setCurrent(i);
    startTimer();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchXRef.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchXRef.current;
    if (Math.abs(dx) > 40) {
      goTo((current + (dx < 0 ? 1 : -1) + slides.length) % slides.length);
    }
    touchXRef.current = null;
  };

  if (slides.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-4" aria-label="প্রধান প্রোমোশন">
      <div className="hero-grid">
        {/* Main slider */}
        <div
          className="hero-slider"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="region"
          aria-roledescription="ক্যারোসেল"
          aria-label="অফার স্লাইডার"
        >
          <div className="hero-track" style={{ transform: `translateX(-${current * 100}%)` }}>
            {slides.map((s, i) => (
              <div
                key={i}
                className="hero-slide"
                role="group"
                aria-roledescription="স্লাইড"
                aria-label={`${i + 1} / ${slides.length}`}
              >
                <div
                  className={cn('ab-banner', s.theme)}
                  onClick={() => bannerNavigate(s.action)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && bannerNavigate(s.action)}
                  aria-label={`${s.title} — ${s.tagline}`}
                >
                  <BannerContent {...s} priority={i === 0} />
                </div>
              </div>
            ))}
          </div>

          {/* Dots (reference site uses dots + swipe, no arrows) */}
          <div className="hero-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={i === current ? 'on' : ''}
                aria-label={`স্লাইড ${i + 1}`}
                aria-current={i === current}
              />
            ))}
          </div>
        </div>

        {/* Two offer banners */}
        <div className="side-banners">
          {banners.map((b, i) => (
            <div
              key={i}
              className={cn('ab-banner side', b.theme)}
              onClick={() => bannerNavigate(b.action)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && bannerNavigate(b.action)}
              aria-label={`${b.title} — ${b.tagline}`}
            >
              <BannerContent title={b.title} tagline={b.tagline} cta={b.cta} photo={b.photo} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   ক্যাটাগরি গ্রিড — Daraz-স্টাইল ছোট অ্যাপ-আইকন টাইল
   ─ মোবাইলে ৫ কলাম / ট্যাবে ৮ / ডেস্কটপে ১০, প্রতি পেজে ২ সারি
   ─ রংধনু গ্রেডিয়েন্ট টাইল + সাদা আইকন (অ্যাডমিন ছবি/রং দিলে সেটাই প্রাধান্য)
   ─ আঙুল টেনে পেজ বদলানো যায় (scroll-snap) + নিচে পেজিনেশন ডট
   ─ টাইলে ক্লিক → শপ পেজে ওই ক্যাটাগরির ফিল্টার
------------------------------------------------------------------- */

// slug → গ্রেডিয়েন্ট (টেইলউইন্ড ক্লাস); না মিললে ইনডেক্স অনুযায়ী সাইকেল
const CATEGORY_TILE_BG: Record<string, string> = {
  electronics: 'from-orange-400 to-amber-500',
  'mobile-tablet': 'from-violet-500 to-purple-600',
  fashion: 'from-fuchsia-500 to-pink-600',
  'home-living': 'from-teal-500 to-emerald-600',
  'beauty-care': 'from-pink-400 to-rose-500',
  'watches-accessories': 'from-emerald-500 to-green-600',
  'bags-luggage': 'from-orange-500 to-red-500',
  'sports-fitness': 'from-rose-500 to-red-600',
  'baby-toys': 'from-lime-500 to-green-500',
  'books-stationery': 'from-amber-400 to-yellow-500',
  grocery: 'from-yellow-400 to-amber-500',
  'office-gadgets': 'from-purple-500 to-fuchsia-600',
  'audio-sound': 'from-teal-400 to-emerald-500',
  'smart-gadgets': 'from-violet-400 to-purple-500',
  'mens-clothing': 'from-zinc-600 to-zinc-800',
  'womens-clothing': 'from-rose-400 to-pink-600',
  shoes: 'from-orange-400 to-rose-500',
};
const TILE_BG_CYCLE = [
  'from-amber-400 to-orange-500',
  'from-violet-500 to-purple-600',
  'from-teal-500 to-emerald-600',
  'from-pink-400 to-rose-500',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-pink-600',
  'from-orange-400 to-red-500',
  'from-emerald-500 to-teal-600',
];

function tileBgClass(slug: string, index: number): string {
  return CATEGORY_TILE_BG[slug] || TILE_BG_CYCLE[index % TILE_BG_CYCLE.length];
}

function CategoryTile({ category, index }: { category: Category; index: number }) {
  const navigate = useStore((s) => s.navigate);
  const label = category.nameBn || category.name;
  const customColor = category.color || null;

  return (
    <button
      type="button"
      onClick={() => navigate({ name: 'shop', category: category.slug })}
      className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
      aria-label={`${label} ক্যাটাগরি দেখুন`}
    >
      <span
        className={cn(
          'relative flex aspect-square w-full max-w-[88px] items-center justify-center overflow-hidden rounded-[26%] shadow-sm transition-transform duration-200 group-hover:scale-105 group-active:scale-95',
          !customColor && 'bg-gradient-to-br',
          !customColor && tileBgClass(category.slug, index),
        )}
        style={customColor ? { background: `linear-gradient(145deg, ${customColor} 0%, ${customColor} 100%)` } : undefined}
      >
        {/* Daraz টাইলের মতো হালকা হাইলাইট/শেড */}
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/10"
          aria-hidden="true"
        />
        {category.image ? (
          <img
            src={category.image}
            alt={label}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <BiIcon
            name={resolveCategoryIcon(category.icon)}
            className="relative h-[46%] w-[46%] text-white drop-shadow"
          />
        )}
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-[1.25] text-foreground/90 sm:text-xs">
        {label}
      </span>
    </button>
  );
}

// রেসপনসিভ ব্রেকপয়েন্ট — SSR-সেফ useSyncExternalStore
// (হাইড্রেশনে সার্ভার স্ন্যাপশট 'm' ব্যবহার হয়, মাউন্টের পরে সত্যিকার মানে আপডেট হয়)
function catBpSubscribe(cb: () => void) {
  const mqSm = window.matchMedia('(min-width: 640px)');
  const mqLg = window.matchMedia('(min-width: 1024px)');
  const handler = () => cb();
  mqSm.addEventListener('change', handler);
  mqLg.addEventListener('change', handler);
  return () => {
    mqSm.removeEventListener('change', handler);
    mqLg.removeEventListener('change', handler);
  };
}
function catBpSnapshot(): 'm' | 'sm' | 'lg' {
  if (window.matchMedia('(min-width: 1024px)').matches) return 'lg';
  if (window.matchMedia('(min-width: 640px)').matches) return 'sm';
  return 'm';
}
const catBpServer = () => 'm' as const;

function CategoryGrid({ categories }: { categories: Category[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const bp = useSyncExternalStore(catBpSubscribe, catBpSnapshot, catBpServer);

  const cols = bp === 'm' ? 5 : bp === 'sm' ? 8 : 10;
  const perPage = cols * 2; // ২ সারি প্রতি পেজ

  // active ক্যাটাগরি — প্যারেন্ট আগে (sortOrder), তারপর সাব-ক্যাটাগরি
  // (categories প্রপ ট্রি বা ফ্ল্যাট — দুই ফরম্যাটেই কাজ করে; id দিয়ে ডুপ্লিকেট বাদ)
  const items = useMemo(() => {
    const seen = new Set<string>();
    const parents: Category[] = [];
    const subs: Category[] = [];
    const visit = (c: Category, isChild: boolean) => {
      if (c.active === false || seen.has(c.id)) return;
      seen.add(c.id);
      (isChild ? subs : parents).push(c);
      for (const ch of c.children || []) visit(ch, true);
    };
    [...categories]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .forEach((c) => visit(c, !!c.parentId));
    return [...parents, ...subs];
  }, [categories]);

  const pages = useMemo(() => {
    const chunks: Category[][] = [];
    for (let i = 0; i < items.length; i += perPage) chunks.push(items.slice(i, i + perPage));
    return chunks.length > 0 ? chunks : [[]];
  }, [items, perPage]);
  const pageCount = pages.length;
  const activePage = Math.min(page, pageCount - 1);

  // স্ক্রল → বর্তমান পেজ সিঙ্ক
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || pageCount <= 1) return;
    const p = Math.min(pageCount - 1, Math.max(0, Math.round(el.scrollLeft / Math.max(el.clientWidth, 1))));
    setPage(p);
  };

  // ডট ক্লিক → ওই পেজে স্মুথ স্ক্রল
  const goto = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setPage(i);
  };

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4" aria-label="ক্যাটাগরি">
      <div className="rounded-2xl bg-muted/60 px-2.5 py-4 sm:px-5">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((chunk, pi) => (
            <div
              key={pi}
              className="grid w-full shrink-0 snap-start content-start grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-8 lg:grid-cols-10"
              inert={activePage !== pi ? true : undefined}
            >
              {chunk.map((c, i) => (
                <CategoryTile key={c.id} category={c} index={pi * perPage + i} />
              ))}
            </div>
          ))}
        </div>
        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5" role="tablist" aria-label="ক্যাটাগরি পেজিনেশন">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={activePage === i}
                aria-label={`ক্যাটাগরি পেজ ${i + 1}`}
                onClick={() => goto(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  activePage === i ? 'w-8 bg-rose-500' : 'w-4 bg-foreground/15 hover:bg-foreground/30',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function SectionHeader({ title, subtitle, action, titleIcon }: { title: string; subtitle?: string; action?: React.ReactNode; titleIcon?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
          <span className="h-6 w-1.5 rounded-full bg-primary" />
          {titleIcon && <BiIcon name={titleIcon} className="text-xl text-primary" />}
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ProductSection({
  title,
  titleIcon,
  subtitle,
  products,
  loading,
  moreAction,
}: {
  title: string;
  titleIcon?: string;
  subtitle?: string;
  products: Product[];
  loading: boolean;
  moreAction?: () => void;
}) {
  if (!loading && products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <SectionHeader
        title={title}
        titleIcon={titleIcon}
        subtitle={subtitle}
        action={
          moreAction && (
            <Button variant="outline" size="sm" onClick={moreAction} className="shrink-0">
              সব দেখুন <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )
        }
      />
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.slice(0, 10).map((p, i) => (
            <ProductCard key={p.id} product={p} eager={i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function OfferCountdown({ endsAt, onExpired }: { endsAt?: string | null; onExpired?: () => void }) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  // এক্সপায়ারি একবারই রিপোর্ট হয় — প্যারেন্ট সেকশন নিজেকে লুকিয়ে ফেলে
  const expiredRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    // Countdown to flash sale end (or next midnight as fallback)
    const tick = () => {
      const now = new Date();
      let end: Date;
      if (endsAt) {
        end = new Date(endsAt);
      } else {
        end = new Date(now);
        end.setHours(24, 0, 0, 0);
      }
      const diff = Math.max(0, end.getTime() - now.getTime());
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
      if (endsAt && diff <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpiredRef.current?.();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-destructive" />
      {[timeLeft.h, timeLeft.m, timeLeft.s].map((v, i) => (
        <span key={i} className="rounded-md bg-destructive/10 px-2 py-1 font-mono text-sm font-bold text-destructive">
          {pad(v)}
        </span>
      ))}
    </div>
  );
}

type FeatureItem = { id: string; icon: string; title: string; desc: string; highlighted: boolean };
type TestimonialItem = { id: string; name: string; area: string | null; text: string; rating: number; highlighted: boolean };

function WhyUs({ features, brand }: { features: FeatureItem[]; brand: string }) {
  if (features.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <SectionHeader title={`কেন ${brand}?`} subtitle="বিশ্বস্ত ব্র্যান্ডের অরিজিনাল পণ্য সবার হাতের নাগালে পৌঁছে দেওয়াই আমাদের অঙ্গীকার" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((it) => (
          <div
            key={it.id}
            className={cn(
              'rounded-xl border bg-card p-5 transition-shadow hover:shadow-md',
              it.highlighted && 'border-primary/50 bg-primary/5 shadow-sm'
            )}
          >
            <div
              className={cn(
                'mb-3 flex h-11 w-11 items-center justify-center rounded-lg',
                it.highlighted ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
              )}
            >
              <BiIcon name={it.icon} className="text-xl" />
            </div>
            <h3 className="flex items-center gap-1.5 font-semibold">
              {it.title}
              {it.highlighted && <BiIcon name="bi-star-fill" className="h-3 w-3 text-amber-500" />}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials({ testimonials }: { testimonials: TestimonialItem[] }) {
  if (testimonials.length === 0) return null;

  return (
    <section className="bg-secondary/40 py-10">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeader title="কাস্টমারদের মতামত" subtitle="যারা আমাদের পণ্যে ভরসা করেন" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((r) => (
            <div
              key={r.id}
              className={cn(
                'rounded-xl border bg-card p-5 transition-shadow hover:shadow-md',
                r.highlighted && 'border-amber-400/60 shadow-sm ring-1 ring-amber-300/40'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn('h-4 w-4', i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
                    />
                  ))}
                </div>
                {r.highlighted && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    <BiIcon name="bi-star-fill" className="h-2.5 w-2.5" /> হাইলাইট
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">&ldquo;{r.text}&rdquo;</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {r.name[0]}
                </span>
                <div>
                  <div className="text-sm font-semibold">{r.name}</div>
                  {r.area && <div className="text-xs text-muted-foreground">{r.area}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** ফ্ল্যাশ সেল সেকশন — অ্যাডমিন-নিয়ন্ত্রিত, সময় শেষ হলে স্বয়ংক্রিয়ভাবে লুকায় */
function FlashSaleSection({ title, endsAt, products }: { title: string; endsAt: string | null; products: Product[] }) {
  // কাউন্টডাউন শেষ হলে সেকশন নিজেই সরে যায় (রিলোড ছাড়াই)
  // endsAt বদলালে (অ্যাডমিন নতুন সময় দিলে) expired রিসেট — রেন্ডার-টাইম অ্যাডজাস্ট
  const [expired, setExpired] = useState(false);
  const [syncedEndsAt, setSyncedEndsAt] = useState(endsAt);
  if (syncedEndsAt !== endsAt) {
    setSyncedEndsAt(endsAt);
    setExpired(false);
  }

  if (products.length === 0 || expired) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6" aria-label="ফ্ল্যাশ সেল">
      <SectionHeader
        title={title || 'ফ্ল্যাশ সেল'}
        titleIcon="bi-lightning-charge-fill"
        subtitle="সীমিত সময়ের বিশেষ ছাড় — স্টক শেষ হওয়ার আগেই অর্ডার করুন"
        action={<OfferCountdown endsAt={endsAt} onExpired={() => setExpired(true)} />}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.slice(0, 10).map((p, i) => (
          <ProductCard key={p.id} product={p} eager={i === 0} />
        ))}
      </div>
    </section>
  );
}

/** সাম্প্রতিক দেখা পণ্য */
function RecentlyViewed({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6" aria-label="সাম্প্রতিক দেখা পণ্য">
      <SectionHeader title="সাম্প্রতিক দেখা পণ্য" titleIcon="bi-eye" subtitle="আপনি সম্প্রতি যেসব পণ্য দেখেছেন" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.slice(0, 10).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

export function HomeView({ categories }: HomeViewProps) {
  const navigate = useStore((s) => s.navigate);
  const settings = useStore((s) => s.siteSettings);

  // সার্ভিস লেয়ার — রিয়েক্টিভ কালেকশন সাবস্ক্রিপশন
  const productsAll = useCollection('products');
  const brandsAll = useCollection('brands');
  const slidesAll = useCollection('slides');
  const sideBannersAll = useCollection('sideBanners');
  const whyUsAll = useCollection('whyUs');
  const testimonialsAll = useCollection('testimonials');
  const paymentsAll = useCollection('paymentMethods');
  const dbCategories = useCollection('categories');

  const cats = categories.length > 0 ? categories : (dbCategories as Category[]);

  // পণ্য সেকশন — সিঙ্ক্রোনাস কোয়েরি (useCollection-এর আপডেটে রি-কম্পিউট)
  const featured = useMemo(() => queryProducts({ featured: true, limit: 10, sort: 'popular' }).products, [productsAll]);
  const bestSellers = useMemo(() => queryProducts({ bestseller: true, limit: 10, sort: 'popular' }).products, [productsAll]);
  const newArrivals = useMemo(() => queryProducts({ isNew: true, limit: 10, sort: 'newest' }).products, [productsAll]);
  const offers = useMemo(() => queryProducts({ offers: true, limit: 10, sort: 'popular' }).products, [productsAll]);

  // হিরো স্লাইড + সাইড ব্যানার (DB থেকে; খালি হলে সিড ফলব্যাক)
  const slides = useMemo<HeroSlide[]>(() => {
    const list = slidesList();
    if (list.length === 0) return HERO_SLIDES;
    return list.map((s) => ({
      theme: `ab-theme-${((s.theme % 4) + 4) % 4}`,
      store: s.store,
      title: s.title,
      tagline: s.tagline,
      priceFrom: s.priceFrom != null ? formatBDT(s.priceFrom) : '',
      discount: s.discount || '',
      cta: s.cta,
      photos: (s.photos || []).slice(0, 3),
      action: s.action,
    }));
  }, [slidesAll]);

  const sideBanners = useMemo<SideBannerItem[]>(() => {
    const list = sideBannersList();
    if (list.length === 0) return SIDE_BANNERS;
    return list.map((b) => ({
      theme: `ab-theme-${((b.theme % 4) + 4) % 4}`,
      title: b.title,
      tagline: b.tagline || b.subtitle || '',
      cta: 'দেখুন',
      photo: b.photo || '',
      action: b.action,
    }));
  }, [sideBannersAll]);

  // ব্র্যান্ড স্ট্রিপ — লোগোসহ (featured আগে)
  const brands = useMemo(() => {
    return [...brandsAll]
      .filter((b) => b.active !== false)
      .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name))
      .slice(0, 14);
  }, [brandsAll]);

  // কেন THE SHOP BD
  const features = useMemo<FeatureItem[]>(() => {
    return whyUsList().map((w, i) => ({
      id: w.id,
      icon: w.icon,
      title: w.title,
      desc: w.text,
      highlighted: i === 0,
    }));
  }, [whyUsAll]);

  // কাস্টমারদের মতামত
  const testimonials = useMemo<TestimonialItem[]>(() => {
    return testimonialsList().map((t, i) => ({
      id: t.id,
      name: t.name,
      area: t.role || null,
      text: t.text,
      rating: t.rating,
      highlighted: i === 0,
    }));
  }, [testimonialsAll]);

  // পেমেন্ট মেথড স্ট্রিপ
  const payments = useMemo(() => paymentsAll.filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder), [paymentsAll]);

  // ফ্ল্যাশ সেল (চালু + সময় বাকি থাকলে) — রিঅ্যাক্টিভ সাবস্ক্রিপশন:
  // অ্যাডমিন থেকে চালু/বন্ধ/সময়/পণ্য বদলালেই হোমপেজ সাথে সাথে আপডেট হয়
  const flashState = useDB().flashSale;
  const flashProducts = useMemo(() => {
    const flash = flashState;
    if (!flash || !flash.enabled || !flash.endsAt) return { title: '', endsAt: null as string | null, products: [] as Product[] };
    if (new Date(flash.endsAt).getTime() <= Date.now()) return { title: '', endsAt: null, products: [] as Product[] };
    const ids = Array.isArray(flash.productIds) ? flash.productIds : [];
    const products = ids
      .map((id) => productById(id))
      .filter((p): p is Product => !!p && p.active);
    return { title: flash.title, endsAt: flash.endsAt, products };
  }, [flashState, productsAll]);

  // সাম্প্রতিক দেখা পণ্য (hydration-safe external store)
  const recentIds = useSyncExternalStore(recentSubscribe, getRecentlyViewed, () => EMPTY_RECENT);
  const recentProducts = useMemo(() => {
    return recentIds
      .map((id) => productById(id))
      .filter((p): p is Product => !!p && p.active);
  }, [recentIds, productsAll]);

  // সেকশন দৃশ্যমানতা (অ্যাডমিন সেটিংস)
  const show = {
    categories: settings.section_categories !== '0',
    brands: settings.section_brands !== '0',
    why: settings.section_why !== '0',
    testimonials: settings.section_testimonials !== '0',
    payment: settings.section_payment !== '0',
    recentlyViewed: settings.section_recently_viewed !== '0',
  };

  return (
    <div>
      <HeroSection slides={slides} banners={sideBanners} />
      {show.categories && <CategoryGrid categories={cats} />}

      {flashProducts.products.length > 0 && (
        <FlashSaleSection title={flashProducts.title} endsAt={flashProducts.endsAt} products={flashProducts.products} />
      )}

      <ProductSection
        title="অফার জোন"
        titleIcon="bi-fire"
        subtitle="সীমিত সময়ের জন্য বিশেষ ছাড়"
        products={offers}
        loading={false}
        moreAction={() => navigate({ name: 'shop', offers: true })}
      />
      <ProductSection
        title="বেস্ট সেলার"
        subtitle="সবচেয়ে বেশি বিক্রিত পণ্য"
        products={bestSellers}
        loading={false}
        moreAction={() => navigate({ name: 'shop' })}
      />
      <ProductSection
        title="ফিচার্ড পণ্য"
        subtitle="আমাদের বাছাই করা সেরা পণ্য"
        products={featured}
        loading={false}
        moreAction={() => navigate({ name: 'shop' })}
      />
      <ProductSection
        title="নতুন এসেছে"
        subtitle="সদ্য সংযোজিত পণ্যসমূহ"
        products={newArrivals}
        loading={false}
        moreAction={() => navigate({ name: 'shop' })}
      />

      {show.recentlyViewed && <RecentlyViewed products={recentProducts} />}

      {/* Brands strip — নাম নয়, ব্র্যান্ড লোগো (admin-controlled) */}
      {show.brands && brands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-6" aria-label="জনপ্রিয় ব্র্যান্ড">
          <SectionHeader title="জনপ্রিয় ব্র্যান্ড" subtitle="আপনার প্রিয় ব্র্যান্ডের পণ্য খুঁজুন" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => navigate({ name: 'shop', brand: b.slug })}
                className={cn(
                  'group flex flex-col items-center gap-2 rounded-xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md',
                  b.featured ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'
                )}
                aria-label={`${b.name} ব্র্যান্ডের পণ্য`}
              >
                <span className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-lg bg-white">
                  {b.logo ? (

                    <img src={b.logo} alt={b.name} width={112} height={44} loading="lazy" className="h-11 w-full object-contain" />
                  ) : (
                    <span className="text-lg font-extrabold text-primary">{b.name[0]?.toUpperCase()}</span>
                  )}
                </span>
                <span className="w-full truncate text-center text-[11px] font-semibold text-muted-foreground group-hover:text-primary">{b.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Payment methods — নাম নয়, লোগো (admin-controlled) */}
      {show.payment && payments.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-6" aria-label="পেমেন্ট মেথড">
          <SectionHeader title="পেমেন্ট মেথড" subtitle="যেভাবে পেমেন্ট করতে পারবেন" titleIcon="bi-credit-card" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {payments.map((m) => (
              <div key={m.id} className="flex h-16 items-center justify-center rounded-xl border bg-white p-2.5 transition-shadow hover:shadow-sm" title={m.name}>
                {m.logo ? (

                  <img src={m.logo} alt={m.name} width={140} height={52} loading="lazy" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm font-bold text-foreground">{m.name}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {show.why && <WhyUs features={features} brand={settings.site_title || 'THE SHOP BD'} />}
      {show.testimonials && <Testimonials testimonials={testimonials} />}
    </div>
  );
}

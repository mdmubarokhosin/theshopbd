'use client';

/**
 * THE SHOP BD — ডেডিকেটেড সার্চ পেজ (/search)
 * ─────────────────────────────────────────────────────────────
 * • হেডারের সার্চ আইকন ও সার্চবার এখানে আসে — domain.com/search?q=...
 * • রিয়েল-টাইম সার্চ: টাইপ করার সাথে সাথে (৩৫০ms ডিবাউন্স) ফলাফল আপডেট হয়
 * • URL সাইলেন্টলি সিঙ্ক হয় (?q=) — শেয়ার/রিফ্রেশেও একই ফলাফল থাকে
 * • সাম্প্রতিক সার্চ (localStorage, useSyncExternalStore) + জনপ্রিয় কিওয়ার্ড
 *   (পণ্যের নাম থেকে স্বয়ংক্রিয়ভাবে গণনা)
 * • ডিবাউন্স চলাকালীন স্পিনার — "লাইভ" অনুভূতি
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Search, X, Clock, TrendingUp, SearchX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductCard } from './product-card';
import { SectionHeader } from './home-view';
import { useStore } from '@/lib/store';
import { toBn, type Product } from '@/lib/types';
import { queryProducts } from '@/lib/db/services';
import { useCollection } from '@/lib/db/hooks';

const RECENT_KEY = 'tsb_recent_searches_v1';
const RECENT_MAX = 8;
const PAGE = 24;

const SORT_OPTIONS = [
  { value: 'popular', label: 'জনপ্রিয়তা' },
  { value: 'newest', label: 'নতুন' },
  { value: 'price_asc', label: 'দাম: কম থেকে বেশি' },
  { value: 'price_desc', label: 'দাম: বেশি থেকে কম' },
  { value: 'rating', label: 'রেটিং' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

/** জেনেরিক ইংরেজি শব্দ — ট্রেন্ডিং কিওয়ার্ড গণনায় বাদ যায় */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'your', 'our', 'all', 'are', 'was',
  'has', 'its', 'off', 'not', 'per', 'new', 'get', 'big', 'com', 'www',
]);

/* ------------------------------------------------------------------
   সাম্প্রতিক সার্চ স্টোর — localStorage-কে useSyncExternalStore-বান্ধব
   করা (স্থিতিশীল স্ন্যাপশট + 'tsb:recent-search' ইভেন্টে ইনভ্যালিডেট)
------------------------------------------------------------------- */
const EMPTY_RECENT: string[] = [];
let recentCache: string[] | null = null;

function recentSubscribe(cb: () => void) {
  window.addEventListener('tsb:recent-search', cb);
  return () => window.removeEventListener('tsb:recent-search', cb);
}

function recentSnapshot(): string[] {
  if (recentCache === null) {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      recentCache = Array.isArray(raw)
        ? raw.filter((x) => typeof x === 'string' && x.trim()).slice(0, RECENT_MAX)
        : [];
    } catch {
      recentCache = [];
    }
  }
  return recentCache;
}

/** localStorage লেখার পরে কল করতে হয় — ক্যাশ ইনভ্যালিডেট + সাবস্ক্রাইবার নোটিফাই */
function bumpRecentStore() {
  recentCache = null;
  window.dispatchEvent(new Event('tsb:recent-search'));
}

type SearchViewProps = { initialQuery?: string };

export function SearchView({ initialQuery }: SearchViewProps) {
  const siteTitle = useStore((s) => s.siteSettings.site_title) || 'THE SHOP BD';

  const [input, setInput] = useState(initialQuery || '');
  const [query, setQuery] = useState(initialQuery || '');
  const [sort, setSort] = useState<SortValue>('popular');
  const [visible, setVisible] = useState(PAGE);
  const inputRef = useRef<HTMLInputElement>(null);

  // সাম্প্রতিক সার্চ — localStorage (SSR-safe: সার্ভারে খালি স্ন্যাপশট)
  const recent = useSyncExternalStore(recentSubscribe, recentSnapshot, () => EMPTY_RECENT);

  // রিঅ্যাকটিভ প্রোডাক্ট কালেকশন — অ্যাডমিনে পণ্য বদলালে সার্চ ফলাফলও লাইভ আপডেট হয়
  const productsAll = useCollection('products');

  // মোবাইল হেডারের সার্চ আইকন → এই পেজে এসে সার্চবার অটো-ফোকাস (কিবোর্ড খোলে)
  const searchFocusTick = useStore((s) => s.searchFocusTick);
  useEffect(() => {
    if (searchFocusTick <= 0) return;
    inputRef.current?.focus();
    useStore.getState().clearSearchFocus();
  }, [searchFocusTick]);

  // প্রথম মাউন্টে অটো-ফোকাস — ডেডিকেটেড সার্চ পেজ
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /** সাম্প্রতিক সার্চে সেভ (ডুপ্লিকেট বাদ, নতুনটা সবার আগে) */
  const pushRecent = (q: string) => {
    const v = q.trim();
    if (!v) return;
    const prev = recentSnapshot();
    const next = [v, ...prev.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, RECENT_MAX);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage full/blocked — চুপচাপ এগিয়ে যাই */
    }
    bumpRecentStore();
  };

  const clearRecent = () => {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
    bumpRecentStore();
  };

  // রিয়েল-টাইম: ৩৫০ms ডিবাউন্সে কমিটেড কুয়েরি আপডেট — টাইপ থামলেই ফলাফল বদলায়
  useEffect(() => {
    const t = setTimeout(() => {
      const v = input.trim();
      setQuery(v);
      if (v) pushRecent(v);
    }, 350);
    return () => clearTimeout(t);
  }, [input]);

  // কমিটেড কুয়েরি বদলালে: URL সাইলেন্ট সিঙ্ক (?q=) + ট্যাব টাইটেল (এক্সটার্নাল সিস্টেম)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = query ? `/search?q=${encodeURIComponent(query)}` : '/search';
    window.history.replaceState(null, '', url);
    const title = query ? `"${query}" সার্চ ফলাফল — ${siteTitle}` : `সার্চ করুন — ${siteTitle}`;
    document.title = title;
    // Next.js App Router নেভিগেশনের পরে স্ট্যাটিক metadata টাইটেল ওভাররাইট করে —
    // এক টিক-পরে আবার সেট করলে ডায়নামিক টাইটেল টিকে যায়
    const t = setTimeout(() => {
      document.title = title;
    }, 120);
    return () => clearTimeout(t);
  }, [query, siteTitle]);

  // কুয়েরি বদলালে পেজিনেশন রিসেট — রেন্ডার-টাইম স্টেট অ্যাডজাস্টমেন্ট (React ডকুমেন্টেড প্যাটার্ন)
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setVisible(PAGE);
  }

  /** চিপ/সাজেশন ক্লিকে সাথে সাথে সার্চ */
  const runSearch = (q: string) => {
    const v = q.trim();
    setInput(v);
    setQuery(v);
    if (v) pushRecent(v);
  };

  const clearSearch = () => {
    setInput('');
    setQuery('');
    inputRef.current?.focus();
  };

  const changeSort = (v: SortValue) => {
    setSort(v);
    setVisible(PAGE);
  };

  // ফলাফল — সিঙ্ক্রোনাস সার্ভিস কোয়েরি (useCollection রিঅ্যাকটিভ)
  const { products, total } = useMemo<{ products: Product[]; total: number }>(() => {
    if (!query) return { products: [], total: 0 };
    return queryProducts({ search: query, sort, limit: visible });
  }, [query, sort, visible, productsAll]);

  // ডিবাউন্স চলছে কিনা (ইনপুট আর কমিটেড কুয়েরি আলাদা হলে) → স্পিনার
  const searching = input.trim() !== query;

  // জনপ্রিয় পণ্য — খালি অবস্থায় ৮টা, ফলাফল খালি হলে ৫টা সাজেশন
  const popular = useMemo(
    () => queryProducts({ sort: 'popular', limit: query ? 5 : 8 }).products,
    [query, productsAll]
  );

  // জনপ্রিয় কিওয়ার্ড — সক্রিয় পণ্যের নাম থেকে শব্দ-ফ্রিকোয়েন্সি (রিয়েল ডেটা)
  const trending = useMemo(() => {
    const freq = new Map<string, number>();
    for (const p of productsAll) {
      if (p.active === false) continue;
      for (const raw of p.name.split(/[\s,()\-–—/|&.]+/)) {
        const w = raw.trim().toLowerCase();
        if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
        freq.set(w, (freq.get(w) || 0) + 1);
      }
    }
    const words = [...freq.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);
    // ফলব্যাক: ফ্রিকোয়েন্ট শব্দ না পেলে জনপ্রিয় পণ্যের নাম থেকে
    if (words.length < 4) {
      for (const p of popular) {
        const short = p.nameBn || p.name;
        if (short && !words.includes(short.toLowerCase())) words.push(short.length > 24 ? `${short.slice(0, 24)}…` : short);
        if (words.length >= 8) break;
      }
    }
    return words;
  }, [productsAll, popular]);

  const hasQuery = !!query;

  return (
    <div>
      {/* হিরো — ব্র্যান্ড গ্রেডিয়েন্ট সার্চ ব্যান্ড */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-dark via-brand to-brand" role="search" aria-label="পণ্য সার্চ">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[18px] border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full border-[14px] border-white/5" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-1/4 h-44 w-44 rounded-full bg-honey/25 blur-2xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-9 text-center sm:py-12">
          <h1 className="text-xl font-bold text-primary-foreground sm:text-2xl">কী খুঁজছেন?</h1>
          <p className="mt-1.5 text-xs text-primary-foreground/80 sm:text-sm">
            {siteTitle}-এর সব ব্র্যান্ডের পণ্য — টাইপ করার সাথে সাথেই রিয়েল-টাইম ফলাফল
          </p>

          <div className="mt-5 flex items-center overflow-hidden rounded-xl bg-background shadow-lg ring-2 ring-honey/70 transition-shadow focus-within:ring-honey">
            <span className="grid w-11 shrink-0 place-items-center text-muted-foreground" aria-hidden>
              {searching ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Search className="h-5 w-5" />}
            </span>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = input.trim();
                  setQuery(v);
                  if (v) pushRecent(v);
                  inputRef.current?.blur();
                }
              }}
              placeholder="পণ্য, ব্র্যান্ড বা SKU লিখুন... (যেমন: পাঞ্জাবি, ঘড়ি, জুতা)"
              className="h-12 border-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="সার্চ করুন"
              enterKeyHint="search"
            />
            {input && (
              <button
                onClick={clearSearch}
                aria-label="সার্চ মুছুন"
                title="সার্চ মুছুন"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Button
              onClick={() => {
                const v = input.trim();
                setQuery(v);
                if (v) pushRecent(v);
              }}
              className="mx-1.5 my-1.5 shrink-0 rounded-lg px-4"
              aria-label="খুঁজুন"
            >
              খুঁজুন
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {hasQuery ? (
          <>
            {/* ফলাফল হেডার */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-base font-bold sm:text-lg">
                  <span className="max-w-full truncate text-primary sm:max-w-md">“{query}”</span>
                  <span>এর ফলাফল</span>
                  <Badge variant="secondary" className="ml-1 shrink-0">
                    {toBn(total)} টি পণ্য
                  </Badge>
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
                  {searching ? 'সার্চ করা হচ্ছে…' : total > 0 ? `${toBn(Math.min(visible, total))} টি পণ্য দেখানো হচ্ছে` : 'কোনো ম্যাচ পাওয়া যায়নি'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="ghost" size="sm" onClick={clearSearch} aria-label="সার্চ মুছে ফিরে যান">
                  <X className="mr-1 h-4 w-4" /> মুছুন
                </Button>
                <Select value={sort} onValueChange={(v) => changeSort(v as SortValue)}>
                  <SelectTrigger className="h-9 w-40 text-xs sm:text-sm" aria-label="সাজান">
                    <SelectValue placeholder="সাজান" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {total === 0 ? (
              /* খালি ফলাফল */
              <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center sm:py-14">
                <SearchX className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <p className="px-4 font-semibold">“{query}” এর জন্য কোনো পণ্য পাওয়া যায়নি</p>
                <p className="mt-1 max-w-md px-4 text-sm text-muted-foreground">
                  বানান চেক করুন অথবা ছোট/অন্য কিওয়ার্ড দিয়ে চেষ্টা করুন
                </p>
                {trending.length > 0 && (
                  <div className="mt-5 flex max-w-xl flex-wrap items-center justify-center gap-2 px-4">
                    {trending.slice(0, 6).map((t) => (
                      <button
                        key={t}
                        onClick={() => runSearch(t)}
                        className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {popular.length > 0 && (
                  <div className="mt-10 w-full px-4 text-left">
                    <h3 className="mb-3 text-sm font-bold">অথবা জনপ্রিয় পণ্যগুলো দেখুন</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {popular.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ফলাফল গ্রিড */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
                {products.length < total && (
                  <div className="mt-8 text-center">
                    <Button variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
                      আরও দেখুন ({toBn(total - products.length)} টি বাকি)
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* সাম্প্রতিক সার্চ */}
            {recent.length > 0 && (
              <div className="mb-7">
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-sm font-bold">
                    <Clock className="h-4 w-4 text-muted-foreground" /> সাম্প্রতিক সার্চ
                  </h2>
                  <button onClick={clearRecent} className="text-xs text-destructive transition-colors hover:underline">
                    সব মুছুন
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => runSearch(r)}
                      className="flex max-w-full items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-accent"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{r}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* জনপ্রিয় কিওয়ার্ড */}
            {trending.length > 0 && (
              <div className="mb-7">
                <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold">
                  <TrendingUp className="h-4 w-4 text-primary" /> জনপ্রিয় কিওয়ার্ড
                </h2>
                <div className="flex flex-wrap gap-2">
                  {trending.map((t) => (
                    <button
                      key={t}
                      onClick={() => runSearch(t)}
                      className="rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* জনপ্রিয় পণ্য */}
            <SectionHeader title="জনপ্রিয় পণ্য" subtitle="অন্য ক্রেতারা যা বেশি খুঁজছেন" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {popular.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

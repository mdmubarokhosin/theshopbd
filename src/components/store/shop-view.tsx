'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, X, Filter, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ProductCard } from './product-card';
import { SectionHeader } from './home-view';
import { useStore } from '@/lib/store';
import type { Category, Product } from '@/lib/types';
import { toBn } from '@/lib/types';
import { cn } from '@/lib/utils';
import { queryProducts, brandBySlug, categoryBySlug } from '@/lib/db/services';
import { useCollection } from '@/lib/db/hooks';

const MAX_PRICE = 12000;
const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'popular', label: 'জনপ্রিয়তা' },
  { value: 'newest', label: 'নতুন' },
  { value: 'price_asc', label: 'দাম: কম থেকে বেশি' },
  { value: 'price_desc', label: 'দাম: বেশি থেকে কম' },
  { value: 'rating', label: 'রেটিং' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

type ShopViewProps = {
  categories: Category[];
  initialCategory?: string;
  initialSearch?: string;
  initialBrand?: string;
  offers?: boolean;
};

export function ShopView({ categories, initialCategory, initialSearch, initialBrand, offers }: ShopViewProps) {
  const navigate = useStore((s) => s.navigate);

  // /category/<slug> — ক্যাটাগরি না মিললে ব্র্যান্ড হিসেবে ফলব্যাক (যেমন /category/sailor)
  const [category, setCategory] = useState<string | undefined>(() =>
    initialCategory && categoryBySlug(initialCategory) ? initialCategory : undefined
  );
  const [search, setSearch] = useState(initialSearch || '');
  const [searchInput, setSearchInput] = useState(initialSearch || '');
  const [sort, setSort] = useState<SortValue>('popular');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, MAX_PRICE]);
  const [brandSlugs, setBrandSlugs] = useState<string[]>(() => {
    if (initialBrand) return [initialBrand];
    if (initialCategory && !categoryBySlug(initialCategory) && brandBySlug(initialCategory)) return [initialCategory];
    return [];
  });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [page, setPage] = useState(1);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // মোবাইল হেডারের সার্চ আইকন → সার্চ পেজে এসে সার্চবার অটো-ফোকাস (কিবোর্ড খোলে)
  const searchFocusTick = useStore((s) => s.searchFocusTick);
  useEffect(() => {
    if (searchFocusTick <= 0) return;
    const el = searchInputRef.current;
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    // একবার ব্যবহারের পর রিসেট — পরের সাধারণ ভিজিটে অযথা ফোকাস হবে না
    useStore.getState().clearSearchFocus();
  }, [searchFocusTick]);

  // সার্ভিস লেয়ার — রিয়েক্টিভ কালেকশন
  const productsAll = useCollection('products');
  const brandsAll = useCollection('brands');
  const dbCategories = useCollection('categories');
  const cats = categories.length > 0 ? categories : (dbCategories as Category[]);

  const brandOptions = useMemo(
    () => brandsAll.filter((b) => b.active !== false).map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
    [brandsAll]
  );

  // সিঙ্ক্রোনাস কোয়েরি (সার্ভিস লেয়ার) — কালেকশন/ফিল্টার পরিবর্তনে রি-কম্পিউট
  // পেজ ফিল্টার পরিবর্তনে সীমার বাইরে গেলে কোয়েরির ভিতরেই ক্ল্যাম্প হয় (extra setState ছাড়া)
  const { products, total, totalPages, effectivePage } = useMemo(() => {
    const runQuery = (p: number): { products: Product[]; total: number } => {
      const q = {
        search: search || undefined,
        category,
        offers,
        inStock: inStockOnly || undefined,
        minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
        maxPrice: priceRange[1] < MAX_PRICE ? priceRange[1] : undefined,
        rating: minRating > 0 ? minRating : undefined,
        sort,
        page: p,
        limit: PAGE_SIZE,
      };
      if (brandSlugs.length === 1) {
        return queryProducts({ ...q, brand: brandSlugs[0] });
      }
      if (brandSlugs.length > 1) {
        // একাধিক ব্র্যান্ড — সার্ভিস কোয়েরির পর ম্যানুয়ালি ফিল্টার + পেজিনেট
        const brandIds = brandSlugs
          .map((s) => brandBySlug(s)?.id)
          .filter((id): id is string => !!id);
        const all = queryProducts({ ...q, limit: 0 });
        const filtered = all.products.filter((p2) => p2.brandId && brandIds.includes(p2.brandId));
        const start = (p - 1) * PAGE_SIZE;
        return { products: filtered.slice(start, start + PAGE_SIZE), total: filtered.length };
      }
      return queryProducts(q);
    };

    const first = runQuery(1);
    const pages = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), pages);
    const res = safePage === 1 ? first : runQuery(safePage);
    return { products: res.products, total: res.total, totalPages: pages, effectivePage: safePage };
  }, [productsAll, brandOptions, category, search, sort, page, priceRange, brandSlugs, inStockOnly, minRating, offers]);

  // খালি ফলাফলে জনপ্রিয় পণ্যের সাজেশন
  const suggested = useMemo(
    () => (products.length === 0 ? queryProducts({ sort: 'popular', limit: 5 }).products : []),
    [products.length, productsAll]
  );

  const activeCategory = useMemo(
    () => cats.find((c) => c.slug === category) || (category ? categoryBySlug(category) : undefined),
    [cats, category]
  );

  const activeBrand = useMemo(
    () => (brandSlugs.length === 1 ? brandsAll.find((b) => b.slug === brandSlugs[0]) : undefined),
    [brandsAll, brandSlugs]
  );

  const changeCategory = (slug?: string) => {
    setCategory(slug);
    setPage(1);
    navigate({ name: 'shop', category: slug, search: search || undefined, offers });
  };

  const hasFilters = !!category || brandSlugs.length > 0 || inStockOnly || minRating > 0 || priceRange[0] > 0 || priceRange[1] < MAX_PRICE;

  const resetFilters = () => {
    setCategory(undefined);
    setBrandSlugs([]);
    setInStockOnly(false);
    setMinRating(0);
    setPriceRange([0, MAX_PRICE]);
    setPage(1);
  };

  const title = offers
    ? 'অফার জোন'
    : activeCategory
      ? `${activeCategory.nameBn || activeCategory.name}`
      : activeBrand && !search
        ? `${activeBrand.nameBn || activeBrand.name} ব্র্যান্ডের পণ্য`
        : search
          ? `"${search}" এর ফলাফল`
          : 'সকল পণ্য';

  const FilterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-bold">ক্যাটাগরি</h3>
        <div className="space-y-1">
          <button
            onClick={() => changeCategory(undefined)}
            className={cn(
              'block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
              !category && 'bg-primary/10 font-semibold text-primary'
            )}
          >
            সকল পণ্য
          </button>
          {cats.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => changeCategory(c.slug)}
                className={cn(
                  'block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                  category === c.slug && 'bg-primary/10 font-semibold text-primary'
                )}
              >
                {c.nameBn || c.name}
              </button>
              {c.children && c.children.length > 0 && (
                <div className="ml-3 border-l pl-2">
                  {c.children.map((sc) => (
                    <div key={sc.id}>
                      <button
                        onClick={() => changeCategory(sc.slug)}
                        className={cn(
                          'block w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                          category === sc.slug && 'bg-primary/10 font-semibold text-primary'
                        )}
                      >
                        {sc.nameBn || sc.name}
                      </button>
                      {/* তৃতীয় স্তর (যেমন ফ্যাশন → ছেলেদের পোশাক → পাঞ্জাবি) */}
                      {sc.children && sc.children.length > 0 && (
                        <div className="ml-3 border-l pl-2">
                          {sc.children.map((gc) => (
                            <button
                              key={gc.id}
                              onClick={() => changeCategory(gc.slug)}
                              className={cn(
                                'block w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                                category === gc.slug && 'bg-primary/10 font-semibold text-primary'
                              )}
                            >
                              {gc.nameBn || gc.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold">দামের রেঞ্জ</h3>
        <Slider
          min={0}
          max={MAX_PRICE}
          step={500}
          value={priceRange}
          onValueChange={(v) => {
            setPriceRange(v as [number, number]);
            setPage(1);
          }}
          className="mb-2"
          aria-label="দামের রেঞ্জ"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>৳{toBn(priceRange[0])}</span>
          <span>৳{toBn(priceRange[1])}+</span>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold">ব্র্যান্ড</h3>
        <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin pr-1">
          {brandOptions.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={brandSlugs.includes(b.slug)}
                onCheckedChange={(checked) => {
                  setBrandSlugs(checked ? [...brandSlugs, b.slug] : brandSlugs.filter((x) => x !== b.slug));
                  setPage(1);
                }}
              />
              {b.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold">রেটিং</h3>
        <div className="space-y-2">
          {[4, 3].map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={minRating === r}
                onCheckedChange={(checked) => {
                  setMinRating(checked ? r : 0);
                  setPage(1);
                }}
              />
              <span className="flex items-center gap-1">
                {toBn(r)}+ <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> রেটিং
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold">অন্যান্য</h3>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={inStockOnly}
            onCheckedChange={(checked) => {
              setInStockOnly(!!checked);
              setPage(1);
            }}
          />
          স্টকে আছে শুধু
        </label>
      </div>
    </div>
  );

  return (
    <div ref={topRef} className="mx-auto max-w-7xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-xs text-muted-foreground" aria-label="ব্রেডক্রাম্ব">
        <button onClick={() => navigate({ name: 'home' })} className="hover:text-primary">হোম</button>
        <span>/</span>
        <span className="font-medium text-foreground">{title}</span>
      </nav>

      <SectionHeader title={title} subtitle={`মোট ${total} টি পণ্য পাওয়া গেছে`} />

      <div className="flex gap-6">
        {/* Sidebar filters (desktop) */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-32 rounded-xl border bg-card p-4 max-h-[calc(100vh-10rem)] overflow-y-auto scrollbar-thin">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Filter className="h-4 w-4" /> ফিল্টার
              </span>
              {hasFilters && (
                <button onClick={resetFilters} className="text-xs text-destructive hover:underline">
                  রিসেট
                </button>
              )}
            </div>
            {FilterPanel}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* মোবাইলে সার্চবার নিজস্ব সারি নেয় (w-full) — ফিল্টার/সর্টের কারণে চাপা পড়ে না */}
            <div className="flex w-full overflow-hidden rounded-lg border sm:w-auto sm:flex-1">
              <Input
                ref={searchInputRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(searchInput);
                    setPage(1);
                  }
                }}
                placeholder="এই পেজে খুঁজুন..."
                className="border-0 focus-visible:ring-0"
                aria-label="পণ্য খুঁজুন"
              />
              <Button
                variant="ghost"
                size="icon"
                className="rounded-none"
                onClick={() => {
                  setSearch(searchInput);
                  setPage(1);
                }}
                aria-label="সার্চ"
              >
                <Search className="h-4 w-4" />
              </Button>
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-none"
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setPage(1);
                    navigate({ name: 'shop', category, offers });
                  }}
                  aria-label="সার্চ মুছুন"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Mobile filter */}
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden">
                  <SlidersHorizontal className="mr-1 h-4 w-4" /> ফিল্টার
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto scrollbar-thin">
                <SheetHeader>
                  <SheetTitle>ফিল্টার</SheetTitle>
                </SheetHeader>
                <div className="p-4">{FilterPanel}</div>
              </SheetContent>
            </Sheet>

            <Select value={sort} onValueChange={(v) => { setSort(v as SortValue); setPage(1); }}>
              <SelectTrigger className="w-44" aria-label="সাজান">
                <SelectValue placeholder="সাজান" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Products grid */}
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <Search className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium">কোনো পণ্য পাওয়া যায়নি</p>
              <p className="mt-1 text-sm text-muted-foreground">ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => {
                resetFilters();
                setSearch('');
                setSearchInput('');
              }}>
                সব ফিল্টার রিসেট করুন
              </Button>
              {suggested.length > 0 && (
                <div className="mt-10 w-full px-4 text-left">
                  <h3 className="mb-3 text-sm font-bold">অথবা জনপ্রিয় পণ্যগুলো দেখুন</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {suggested.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                disabled={effectivePage === 1}
                onClick={() => { setPage(effectivePage - 1); topRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                aria-label="পূর্ববর্তী পেজ"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button
                  key={i}
                  variant={effectivePage === i + 1 ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => { setPage(i + 1); topRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                  aria-label={`পেজ ${i + 1}`}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                disabled={effectivePage === totalPages}
                onClick={() => { setPage(effectivePage + 1); topRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                aria-label="পরবর্তী পেজ"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

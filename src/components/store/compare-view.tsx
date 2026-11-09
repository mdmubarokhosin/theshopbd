'use client';

import { useEffect, useMemo } from 'react';
import { Star, X, ShoppingBag, ArrowRight, GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { useCart } from '@/lib/use-cart';
import { toast } from '@/hooks/use-toast';
import { productById, decorate } from '@/lib/db/services';
import { toggleCompare, getCompareList } from '@/lib/db/auth';
import { formatBDT, toBn, discountPercent } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CompareView() {
  const navigate = useStore((s) => s.navigate);
  const compare = useStore((s) => s.compare);
  const setCompare = useStore((s) => s.setCompare);
  const { addItem } = useCart();

  // tsb:compare ইভেন্টের সাথে স্টোর সিঙ্ক
  useEffect(() => {
    const sync = () => setCompare(getCompareList());
    sync();
    window.addEventListener('tsb:compare', sync);
    return () => window.removeEventListener('tsb:compare', sync);
  }, [setCompare]);

  const products = useMemo(
    () => compare.map((id) => productById(id)).filter((p) => !!p && p.active).map((p) => decorate(p!)),
    [compare]
  );

  const remove = (id: string) => {
    toggleCompare(id);
    toast({ title: 'তুলনা থেকে সরানো হয়েছে' });
  };

  const addToCart = (id: string, hasVariants: boolean, slug: string) => {
    if (hasVariants) {
      navigate({ name: 'product', slug });
      return;
    }
    const res = addItem(id, 1);
    if (res.ok) toast({ title: 'কার্টে যোগ হয়েছে' });
    else toast({ title: 'যোগ করা যায়নি', description: res.error, variant: 'destructive' });
  };

  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <GitCompareArrows className="h-9 w-9 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">তুলনা করার পণ্য নেই</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            পণ্য পেজ থেকে "তুলনা করুন" বাটনে ক্লিক করে সর্বোচ্চ ৪টি পণ্য পাশাপাশি তুলনা করুন।
          </p>
          <Button className="mt-6" onClick={() => navigate({ name: 'shop' })}>
            কেনাকাটা শুরু করুন <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const rows: { label: string; render: (p: (typeof products)[number]) => React.ReactNode }[] = [
    {
      label: 'ছবি',
      render: (p) => (
        <div className="mx-auto h-28 w-28 overflow-hidden rounded-xl border bg-muted sm:h-32 sm:w-32">
          {getImg(p) ? (
            <img src={getImg(p)!} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center"><ShoppingBag className="h-8 w-8 text-muted-foreground/30" /></div>
          )}
        </div>
      ),
    },
    {
      label: 'নাম',
      render: (p) => (
        <button
          onClick={() => navigate({ name: 'product', slug: p.slug })}
          className="text-sm font-semibold leading-snug hover:text-primary"
        >
          {p.nameBn || p.name}
        </button>
      ),
    },
    {
      label: 'দাম',
      render: (p) => (
        <div>
          <div className="text-base font-bold text-primary">{formatBDT(p.price)}</div>
          {p.comparePrice && p.comparePrice > p.price && (
            <div className="text-xs text-muted-foreground line-through">{formatBDT(p.comparePrice)}</div>
          )}
        </div>
      ),
    },
    {
      label: 'ছাড়',
      render: (p) => {
        const d = discountPercent(p.price, p.comparePrice);
        return d > 0
          ? <Badge className="bg-destructive text-white hover:bg-destructive">-{d}%</Badge>
          : <span className="text-sm text-muted-foreground">—</span>;
      },
    },
    {
      label: 'রেটিং',
      render: (p) => (
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn('h-3.5 w-3.5', i < Math.round(p.rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">{toBn(p.rating)} ({toBn(p.reviewCount)} রিভিউ)</span>
        </div>
      ),
    },
    {
      label: 'স্টক',
      render: (p) =>
        p.stock > 0 ? (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            স্টকে আছে ({toBn(p.stock)})
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">স্টক শেষ</Badge>
        ),
    },
    {
      label: 'ব্র্যান্ড',
      render: (p) => <span className="text-sm">{p.brand ? p.brand.name : '—'}</span>,
    },
    {
      label: 'ক্যাটাগরি',
      render: (p) => <span className="text-sm">{p.category ? (p.category.nameBn || p.category.name) : '—'}</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold sm:text-2xl">পণ্য তুলনা</h1>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
            {toBn(products.length)} টি পণ্য
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { for (const p of products) toggleCompare(p.id); }}>
          সব সরান
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card scrollbar-thin">
        <table className="w-full min-w-[640px] border-collapse">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.label} className={cn(ri !== rows.length - 1 && 'border-b')}>
                <th scope="row" className="w-24 shrink-0 border-r bg-muted/50 p-3 text-left align-middle text-xs font-bold text-muted-foreground sm:w-32">
                  {row.label}
                </th>
                {products.map((p) => (
                  <td key={p.id} className="p-3 text-center align-middle">
                    {row.render(p)}
                  </td>
                ))}
              </tr>
            ))}
            {/* অ্যাকশন রো */}
            <tr className="border-b-0">
              <th scope="row" className="border-r bg-muted/50 p-3 text-left align-middle text-xs font-bold text-muted-foreground">
                অ্যাকশন
              </th>
              {products.map((p) => {
                const hasVariants = (p.variants?.length || 0) > 0;
                const out = p.stock <= 0;
                return (
                  <td key={p.id} className="p-3 text-center align-middle">
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        size="sm"
                        className="font-semibold"
                        disabled={out}
                        onClick={() => addToCart(p.id, hasVariants, p.slug)}
                      >
                        <ShoppingBag className="mr-1.5 h-4 w-4" /> কার্টে যোগ
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => remove(p.id)}
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> সরান
                      </Button>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        মোবাইলে টেবিলটি পাশে স্লাইড করে দেখুন · সর্বোচ্চ ৪টি পণ্য তুলনা করা যায়
      </p>
    </div>
  );
}

function getImg(p: { images: string; variants?: { image?: string | null }[] }): string | null {
  try {
    const arr = JSON.parse(p.images);
    if (Array.isArray(arr) && arr.length) return arr[0];
  } catch {
    if (p.images) return p.images;
  }
  return null;
}

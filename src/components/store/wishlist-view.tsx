'use client';

import { useMemo } from 'react';
import { Heart, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from './product-card';
import { useStore } from '@/lib/store';
import { productById } from '@/lib/db/services';
import type { Product } from '@/lib/types';

export function WishlistView() {
  const navigate = useStore((s) => s.navigate);
  const wishlist = useStore((s) => s.wishlist);

  const products = useMemo(
    () =>
      wishlist
        .map((id) => productById(id))
        .filter((p): p is Product => !!p && p.active),
    [wishlist]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Heart className="h-6 w-6 text-destructive" />
        <h1 className="text-xl font-bold sm:text-2xl">আমার উইশলিস্ট</h1>
        {wishlist.length > 0 && (
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
            {wishlist.length} টি পণ্য
          </span>
        )}
      </div>

      {wishlist.length === 0 || products.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
          <Heart className="mb-3 h-12 w-12 text-muted-foreground/25" />
          <p className="font-semibold">আপনার উইশলিস্ট খালি</p>
          <p className="mt-1 text-sm text-muted-foreground">পছন্দের পণ্যে হার্ট আইকনে ক্লিক করে এখানে সংরক্ষণ করুন</p>
          <Button className="mt-5" onClick={() => navigate({ name: 'shop' })}>
            <ShoppingBag className="mr-1.5 h-4 w-4" /> কেনাকাটা শুরু করুন
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WishlistSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

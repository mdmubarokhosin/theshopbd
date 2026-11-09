'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Heart, Star, ShoppingBag, Eye, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { useCart } from '@/lib/use-cart';
import { toast } from '@/hooks/use-toast';
import { formatBDT, discountPercent, toBn, type Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { safeImages } from '@/lib/db/services';
import { useCollection } from '@/lib/db/hooks';

export function ProductCard({ product, compact = false, eager = false }: { product: Product; compact?: boolean; eager?: boolean }) {
  const navigate = useStore((s) => s.navigate);
  const wishlist = useStore((s) => s.wishlist);
  const toggleWishlist = useStore((s) => s.toggleWishlist);
  const { addItem } = useCart();
  const brandsAll = useCollection('brands');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const images = useMemo(() => safeImages(product), [product]);
  const image = images[0] || '/products/tshirt.png';
  const discount = discountPercent(product.price, product.comparePrice);
  const inWishlist = wishlist.includes(product.id);
  const outOfStock = product.stock <= 0;
  const hasVariants = (product.variants?.length || 0) > 0;

  // ব্র্যান্ড নাম (প্রোডাক্টে জয়েন করা না থাকলে সার্ভিস লেয়ার থেকে)
  const brandName = useMemo(() => {
    if (product.brand?.name) return product.brand.name;
    if (!product.brandId) return undefined;
    return brandsAll.find((b) => b.id === product.brandId)?.name;
  }, [product.brand, product.brandId, brandsAll]);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock || adding) return;
    // Products with variants need explicit selection → go to detail page
    if (hasVariants) {
      navigate({ name: 'product', slug: product.slug });
      return;
    }
    setAdding(true);
    const result = addItem(product.id, 1, '');
    setAdding(false);
    if (result.ok) {
      setAdded(true);
      toast({ title: 'কার্টে যোগ হয়েছে', description: `${product.nameBn || product.name} — ${formatBDT(product.price)}` });
      setTimeout(() => setAdded(false), 1500);
    } else {
      toast({ title: 'কার্টে যোগ করা যায়নি', description: result.error, variant: 'destructive' });
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
    toast({
      title: inWishlist ? 'উইশলিস্ট থেকে সরানো হয়েছে' : 'উইশলিস্টে যোগ হয়েছে',
      description: product.nameBn || product.name,
    });
  };

  return (
    <div
      onClick={() => navigate({ name: 'product', slug: product.slug })}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate({ name: 'product', slug: product.slug })}
      aria-label={product.name}
    >
      {/* Badges */}
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
        {discount > 0 && (
          <Badge className="bg-destructive px-1.5 text-[11px] font-bold text-white hover:bg-destructive">
            -{discount}%
          </Badge>
        )}
        {product.isNew && (
          <Badge className="bg-honey px-1.5 text-[11px] font-bold text-white hover:bg-honey">নতুন</Badge>
        )}
        {product.isBestSeller && (
          <Badge className="bg-primary px-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary">বেস্ট সেলার</Badge>
        )}
      </div>

      {/* Wishlist button */}
      <button
        onClick={handleWishlist}
        className={cn(
          'absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-all hover:scale-110',
          inWishlist ? 'text-destructive' : 'text-muted-foreground'
        )}
        aria-label={inWishlist ? 'উইশলিস্ট থেকে সরান' : 'উইশলিস্টে যোগ করুন'}
      >
        <Heart className={cn('h-4 w-4', inWishlist && 'fill-current')} />
      </button>

      {/* Image */}
      <div className={cn('relative overflow-hidden bg-muted product-img-zoom', compact ? 'aspect-square' : 'aspect-[4/5]')}>
        <Image
          src={image}
          alt={product.name}
          fill
          unoptimized
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={eager}
          loading={eager ? 'eager' : undefined}
        />
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded bg-white px-3 py-1 text-xs font-bold text-destructive">স্টক শেষ</span>
          </div>
        )}
        {/* Quick view on hover */}
        <div className="absolute inset-x-0 bottom-0 hidden translate-y-full items-center justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 transition-transform duration-300 group-hover:translate-y-0 md:flex">
          <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-foreground">
            <Eye className="h-3.5 w-3.5" /> বিস্তারিত দেখুন
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        {brandName && (
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{brandName}</span>
        )}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug hover:text-primary">
          {product.nameBn || product.name}
        </h3>

        <div className="mt-1 flex items-center gap-1">
          <div className="flex items-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-3 w-3',
                  i < Math.round(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                )}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">({product.reviewCount})</span>
          {hasVariants && (
            <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {toBn(product.variants!.length)} ভ্যারিয়েন্ট
            </span>
          )}
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <div className="text-base font-bold text-primary">{formatBDT(product.price)}</div>
            {product.comparePrice && product.comparePrice > product.price && (
              <div className="text-xs text-muted-foreground line-through">{formatBDT(product.comparePrice)}</div>
            )}
          </div>
          <Button
            size="icon"
            className={cn('h-9 w-9 shrink-0', added && 'bg-green-600 hover:bg-green-600')}
            onClick={handleAdd}
            disabled={outOfStock || adding}
            aria-label="কার্টে যোগ করুন"
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

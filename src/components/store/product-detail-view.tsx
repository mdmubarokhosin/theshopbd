'use client';

/**
 * প্রোডাক্ট ডিটেইল — Android নেটিভ অ্যাপ স্টাইল
 * ─────────────────────────────────────────────────────────────
 * মোবাইল: ফুল-ব্লিড সোয়াইপ ক্যারোসেল → গোল-কর্নার কনটেন্ট শিট →
 *         স্টিকি বটম অ্যাকশন বার (কার্টে যোগ / এখনই কিনুন)।
 * ডেস্কটপ: ২-কলাম ক্লাসিক লেআউট (স্টিকি গ্যালারি + ইনফো)।
 * সব লজিক (ভ্যারিয়েন্ট, রিভিউ, উইশলিস্ট, কম্পেয়ার, ডেলিভারি জোন) অপরিবর্তিত।
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import {
  ChevronLeft, ChevronRight, Star, ShoppingBag, Heart, Truck,
  ShieldCheck, RotateCcw, Minus, Plus, BadgeCheck, Check, Palette, Ruler,
  ThumbsUp, ArrowLeft, Share2, ChevronDown, Columns2, Camera, Loader2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { ProductCard } from './product-card';
import { useStore } from '@/lib/store';
import { useCart } from '@/lib/use-cart';
import { toast } from '@/hooks/use-toast';
import {
  formatBDT, discountPercent, parseColors, parseSizes, buildVariantKey, toBn,
  type Product,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { BiIcon } from '@/lib/icons';
import {
  productBySlug, safeImages, relatedProducts, addReview, markReviewHelpful,
} from '@/lib/db/services';
import { db } from '@/lib/db/core';
import { pushRecentlyViewed, toggleCompare, getCompareList } from '@/lib/db/auth';
import { useCurrentUser, useCollection } from '@/lib/db/hooks';
import { trackViewItem } from '@/lib/analytics';
import { waProductLink } from './whatsapp-float';
import { MessageCircle } from 'lucide-react';
import type { Review } from '@/lib/db/types';

function StarRating({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn(size, i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

/** SSR হাইড্রেশন-মিসম্যাচ এড়াতে গ্যালারির সার্ভার স্ন্যাপশট (খালি তালিকা) */
const EMPTY_IMAGES: string[] = [];

export function ProductDetailView({ slug }: { slug: string }) {
  const navigate = useStore((s) => s.navigate);
  const goBack = useStore((s) => s.goBack);
  const wishlist = useStore((s) => s.wishlist);
  const toggleWishlist = useStore((s) => s.toggleWishlist);
  const compare = useStore((s) => s.compare);
  const setCompare = useStore((s) => s.setCompare);
  const { addItem } = useCart();
  const { user } = useCurrentUser();

  // সার্ভিস লেয়ার — রিয়েক্টিভ কালেকশন
  const productsAll = useCollection('products');
  const reviewsAll = useCollection('reviews');
  const categoriesAll = useCollection('categories');
  const brandsAll = useCollection('brands');
  const zonesAll = useCollection('deliveryZones');
  const settings = useStore((s) => s.siteSettings);

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '' });
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [uploadingReviewImg, setUploadingReviewImg] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);

  // সিঙ্ক্রোনাস লোড — slug পরিবর্তনে রি-সিলেক্ট
  const product = useMemo(() => {
    const p = productBySlug(slug);
    if (!p) return null;
    return {
      ...p,
      category: categoriesAll.find((c) => c.id === p.categoryId),
      brand: p.brandId ? brandsAll.find((b) => b.id === p.brandId) ?? null : null,
    };
  }, [slug, productsAll, categoriesAll, brandsAll]);

  const parentCategory = useMemo(() => {
    const c = product?.category;
    if (!c?.parentId) return null;
    return categoriesAll.find((x) => x.id === c.parentId) ?? null;
  }, [product?.category, categoriesAll]);

  // ভ্যারিয়েন্ট ডিফল্ট সিলেকশন — মাউন্ট ও slug পরিবর্তনে রেন্ডার-টাইমে অ্যাডজাস্ট
  const [syncedSlug, setSyncedSlug] = useState<string | null>(null);
  if (syncedSlug !== slug) {
    setSyncedSlug(slug);
    setQuantity(1);
    setActiveImage(0);
    const p = productBySlug(slug);
    if (p) {
      const colors = parseColors(p.colors);
      const sizes = parseSizes(p.sizes);
      const variants = p.variants || [];
      if (variants.length > 0) {
        const first = variants[0];
        setSelectedColor(first.color || (colors[0]?.name ?? null));
        setSelectedSize(first.size || (sizes[0] ?? null));
      } else {
        setSelectedColor(null);
        setSelectedSize(null);
      }
    }
  }

  // সাম্প্রতিক দেখা তালিকায় যোগ
  useEffect(() => {
    if (product) pushRecentlyViewed(product.id);
  }, [product?.id]);

  // GA4 + Facebook Pixel — view_item ইভেন্ট
  useEffect(() => {
    if (product) {
      trackViewItem({
        id: product.id,
        name: product.nameBn || product.name,
        price: product.price,
        category: product.category?.slug,
      });
    }
  }, [product?.id]);  

  // তুলনার তালিকা স্টোরে সিঙ্ক (rAF-এ — zustand আপডেট রেন্ডারের বাইরে)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setCompare(getCompareList()));
    return () => cancelAnimationFrame(raf);
  }, []);

  const images = useMemo(() => (product ? safeImages(product) : []), [product]);

  // গ্যালারি — useSyncExternalStore: SSR/হাইড্রেশনে খালি তালিকা, mount-এর পর ক্লায়েন্ট DB থেকে।
  // এতে সার্ভার সিড ও ইউজারের localStorage আলাদা হলেও hydration mismatch হয় না।
  const galleryStore = useMemo(
    () => ({
      subscribe: (cb: () => void) => db.subscribe(cb),
      getClient: () => images,
      getServer: () => EMPTY_IMAGES,
    }),
    [images]
  );
  const galleryImages = useSyncExternalStore(galleryStore.subscribe, galleryStore.getClient, galleryStore.getServer);
  const colorOptions = useMemo(() => parseColors(product?.colors), [product]);
  const sizeOptions = useMemo(() => parseSizes(product?.sizes), [product]);
  const variants = useMemo(() => product?.variants || [], [product]);
  const hasVariants = variants.length > 0;

  // Resolve the selected variant
  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    const key = buildVariantKey(selectedColor, selectedSize);
    return variants.find((v) => v.key === key) || null;
  }, [hasVariants, selectedColor, selectedSize, variants]);

  const effectivePrice = selectedVariant ? selectedVariant.price : product?.price ?? 0;
  const effectiveStock = selectedVariant ? selectedVariant.stock : product?.stock ?? 0;
  const discount = product ? discountPercent(effectivePrice, product.comparePrice) : 0;
  const inWishlist = product ? wishlist.includes(product.id) : false;
  const inCompare = product ? compare.includes(product.id) : false;
  const outOfStock = effectiveStock <= 0;
  const totalPrice = effectivePrice * quantity;

  // WhatsApp অর্ডার লিংক (অ্যাডমিন সেটিংস চালু থাকলে)
  const waLink = useMemo(
    () =>
      product && typeof window !== 'undefined'
        ? waProductLink({ slug: product.slug, name: product.name, nameBn: product.nameBn, price: effectivePrice })
        : null,
    [product, effectivePrice]
  );

  // রিভিউ: অনুমোদিত + নিজের অপেক্ষমাণ রিভিউ ("পর্যালোচনাধীন" ব্যাজসহ)
  const reviews = useMemo(() => {
    if (!product) return [] as Review[];
    const approved = reviewsAll
      .filter((r) => r.productId === product.id && r.status === 'APPROVED')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const minePending = user
      ? reviewsAll.filter((r) => r.productId === product.id && r.status === 'PENDING' && r.userId === user.id)
      : [];
    return [...approved, ...minePending];
  }, [product, reviewsAll, user]);

  // রেটিং সামারি (গড়, সংখ্যা)
  const reviewSummary = useMemo(() => {
    const approved = reviews.filter((r) => r.status === 'APPROVED');
    const count = approved.length;
    const avg = count
      ? Math.round((approved.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : product?.rating ?? 0;
    return { count, avg };
  }, [reviews, product]);

  // সম্পর্কিত পণ্য
  const related = useMemo(() => (product ? relatedProducts(product, 6) : []), [product, productsAll]);

  // ডেলিভারি জোন
  const zones = useMemo(
    () => zonesAll.filter((z) => z.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [zonesAll]
  );
  const freeShippingThreshold = Number(settings.free_shipping_threshold) || 2000;

  // When color/size selection changes, show variant image if available (render-time adjust)
  const [syncedVariantKey, setSyncedVariantKey] = useState<string | null | undefined>(undefined);
  if ((selectedVariant?.key ?? null) !== syncedVariantKey) {
    setSyncedVariantKey(selectedVariant?.key ?? null);
    if (selectedVariant?.image && images.includes(selectedVariant.image)) {
      setActiveImage(Math.max(0, images.indexOf(selectedVariant.image)));
    }
  }

  // ── মোবাইল ক্যারোসেল — সোয়াইপে স্লাইড ইনডেক্স ট্র্যাক ──
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollRaf = useRef(0);
  const onCarouselScroll = () => {
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      const el = carouselRef.current;
      if (!el || el.clientWidth === 0) return;
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      if (idx !== activeImage && idx >= 0 && idx < images.length) setActiveImage(idx);
    });
  };
  const gotoImage = (i: number) => {
    setActiveImage(i);
    const el = carouselRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const handleAdd = async (goToCart = false) => {
    if (!product || outOfStock) return;
    if (hasVariants && !selectedVariant) {
      toast({ title: 'ভ্যারিয়েন্ট নির্বাচন করুন', description: 'রং বা সাইজ নির্বাচন করুন', variant: 'destructive' });
      return;
    }
    setAdding(true);
    const result = await addItem(product.id, quantity, hasVariants ? selectedVariant?.key ?? '' : '');
    setAdding(false);
    if (result.ok) {
      if (goToCart) {
        navigate({ name: 'cart' });
      } else {
        setAdded(true);
        toast({ title: 'কার্টে যোগ হয়েছে', description: product.nameBn || product.name });
        setTimeout(() => setAdded(false), 1500);
      }
    } else {
      toast({ title: 'কার্টে যোগ করা যায়নি', description: result.error, variant: 'destructive' });
    }
  };

  const handleCompare = () => {
    if (!product) return;
    const next = toggleCompare(product.id);
    setCompare(next);
    toast({
      title: next.includes(product.id) ? 'তুলনার তালিকায় যোগ হয়েছে' : 'তুলনার তালিকা থেকে সরানো হয়েছে',
      description: product.nameBn || product.name,
    });
  };

  // শেয়ার — নেটিভ শেয়ার শিট, না থাকলে লিঙ্ক কপি
  const handleShare = async () => {
    if (!product) return;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/product/${product.slug}` : '';
    const title = product.nameBn || product.name;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: 'লিঙ্ক কপি হয়েছে', description: 'বন্ধুদের সাথে শেয়ার করুন' });
    } catch {
      /* ইউজার শেয়ার বাতিল করেছে — নীরব */
    }
  };

  // রিভিউ ফর্ম — লগইন ইউজারের নাম প্রি-ফিল (রেন্ডার-টাইম অ্যাডজাস্ট)
  if (user && !reviewForm.name) {
    setReviewForm((f) => (f.name ? f : { ...f, name: user.name }));
  }

  const submitReview = async () => {
    if (!product) return;
    if (!reviewForm.name.trim() || !reviewForm.comment.trim()) {
      toast({ title: 'নাম ও মতামত লিখুন', variant: 'destructive' });
      return;
    }
    setSubmittingReview(true);
    try {
      addReview({
        productId: product.id,
        name: reviewForm.name.trim(),
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim(),
        images: reviewImages,
      });
      toast({ title: 'রিভিউ জমা হয়েছে', description: 'অনুমোদনের পর দেখা যাবে — ধন্যবাদ!' });
      setReviewForm((f) => ({ ...f, comment: '' }));
      setReviewImages([]);
      setReviewFormOpen(false);
    } catch {
      toast({ title: 'সমস্যা হয়েছে', description: 'আবার চেষ্টা করুন', variant: 'destructive' });
    } finally {
      setSubmittingReview(false);
    }
  };

  /** রিভিউতে ছবি যোগ (সর্বোচ্চ ৩টি) — GitHub হোস্টিং থাকলে CDN URL, নইলে dataURL */
  const addReviewImage = async (file: File) => {
    if (reviewImages.length >= 3) {
      toast({ title: 'সর্বোচ্চ ৩টি ছবি যোগ করা যায়', variant: 'destructive' });
      return;
    }
    setUploadingReviewImg(true);
    try {
      const { fileToDataUrl } = await import('@/lib/db/image-tools');
      const { isGithubConfigured, uploadDataUrlToGithub } = await import('@/lib/db/github');
      const dataUrl = await fileToDataUrl(file, 800);
      let finalUrl = dataUrl;
      if (isGithubConfigured()) {
        const res = await uploadDataUrlToGithub(dataUrl, `review-${Date.now()}.jpg`, 'reviews');
        if (res.ok && res.url) finalUrl = res.url;
      }
      setReviewImages((imgs) => [...imgs, finalUrl]);
    } catch {
      toast({ title: 'ছবি আপলোড করা যায়নি', variant: 'destructive' });
    } finally {
      setUploadingReviewImg(false);
    }
  };

  const handleHelpful = (reviewId: string) => {
    markReviewHelpful(reviewId);
    toast({ title: 'ধন্যবাদ!', description: 'আপনার মতামত রেকর্ড করা হয়েছে' });
  };

  if (!product) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center">
        <p className="text-lg font-semibold">পণ্যটি খুঁজে পাওয়া যায়নি</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => goBack()}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> পেছনে যান
          </Button>
          <Button onClick={() => navigate({ name: 'shop' })}>সকল পণ্য দেখুন</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 md:pb-0">
      {/* ═══════════ ডেস্কটপ ব্রেডক্রাম্ব ═══════════ */}
      <div className="mx-auto hidden max-w-7xl px-4 md:block">
        <nav className="mb-4 flex flex-wrap items-center gap-1 pt-4 text-xs text-muted-foreground" aria-label="ব্রেডক্রাম্ব">
          <button onClick={() => navigate({ name: 'home' })} className="hover:text-primary">হোম</button>
          <span>/</span>
          {parentCategory && (
            <>
              <button onClick={() => navigate({ name: 'shop', category: parentCategory.slug })} className="hover:text-primary">
                {parentCategory.nameBn || parentCategory.name}
              </button>
              <span>/</span>
            </>
          )}
          <button onClick={() => navigate({ name: 'shop', category: product.category?.slug })} className="hover:text-primary">
            {product.category?.nameBn || product.category?.name || 'সকল পণ্য'}
          </button>
          <span>/</span>
          <span className="max-w-[240px] truncate font-medium text-foreground">{product.nameBn || product.name}</span>
        </nav>
      </div>

      <div className="mx-auto max-w-7xl md:px-4 md:pb-10">
        <div className="md:grid md:grid-cols-2 md:gap-10 lg:gap-14">
          {/* ═══════════ মোবাইল গ্যালারি — ফুল-ব্লিড সোয়াইপ ক্যারোসেল ═══════════ */}
          <div className="relative md:hidden">
            <div ref={carouselRef} onScroll={onCarouselScroll} className="pd-carousel aspect-square bg-muted" data-selectable>
              {galleryImages.map((img: string, i: number) => (
                <div key={i} className="relative aspect-square bg-muted">
                  <Image
                    key={`pd-img-${i}-${activeImage === i}`}
                    src={img}
                    alt={`${product.nameBn || product.name} — ছবি ${i + 1}`}
                    fill
                    priority={i === 0}
                    loading={i === 0 ? 'eager' : undefined}
                    unoptimized
                    sizes="100vw"
                    className={cn('object-cover', activeImage === i && 'pd-img-in')}
                  />
                </div>
              ))}
            </div>

            {/* ফ্লোটিং কন্ট্রোল — অ্যাপ স্টাইল */}
            {discount > 0 && (
              <Badge className="pointer-events-none absolute left-3 top-3 z-10 bg-destructive font-bold text-white shadow">
                -{toBn(discount)}%
              </Badge>
            )}
            <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">
              {toBn(activeImage + 1)}/{toBn(galleryImages.length)}
            </span>

            {/* ডট ইন্ডিকেটর */}
            {galleryImages.length > 1 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
                {galleryImages.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      i === activeImage ? 'w-5 bg-primary' : 'w-1.5 bg-foreground/25'
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ═══════════ ডেস্কটপ গ্যালারি ═══════════ */}
          <div className="hidden self-start md:sticky md:top-24 md:block">
            <div className="relative aspect-square overflow-hidden rounded-2xl border bg-muted">
              {discount > 0 && (
                <Badge className="absolute left-3 top-3 z-10 bg-destructive font-bold text-white">-{toBn(discount)}% ছাড়</Badge>
              )}
              <Image
                key={`dt-img-${activeImage}`}
                src={galleryImages[activeImage] || '/products/tshirt.png'}
                alt={product.name}
                fill
                priority
                unoptimized
                className="pd-img-in object-cover"
                sizes="(max-width: 1024px) 50vw, 560px"
              />
              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImage((activeImage - 1 + galleryImages.length) % galleryImages.length)}
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow hover:bg-white"
                    aria-label="পূর্ববর্তী ছবি"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setActiveImage((activeImage + 1) % galleryImages.length)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow hover:bg-white"
                    aria-label="পরবর্তী ছবি"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-thin">
                {galleryImages.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                      i === activeImage ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                    )}
                    aria-label={`ছবি ${i + 1}`}
                  >
                    <Image src={img} alt="" fill unoptimized className="object-cover" sizes="64px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ═══════════ ইনফো — মোবাইলে শিট, ডেস্কটপে কলাম ═══════════ */}
          <div className="pd-sheet px-4 pb-8 pt-5 md:p-0 md:pt-2">
            {/* মোবাইল ব্যাক + অ্যাকশন রো */}
            <div className="mb-3 flex items-center justify-between md:hidden">
              <button
                onClick={() => goBack()}
                className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground shadow-sm press-effect"
                aria-label="পেছনে যান"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground shadow-sm press-effect"
                  aria-label="শেয়ার করুন"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    toggleWishlist(product.id);
                    toast({ title: inWishlist ? 'উইশলিস্ট থেকে সরানো হয়েছে' : 'উইশলিস্টে যোগ হয়েছে' });
                  }}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border bg-card shadow-sm press-effect',
                    inWishlist ? 'border-destructive/30 text-destructive' : 'text-foreground'
                  )}
                  aria-label="উইশলিস্টে যোগ করুন"
                >
                  <Heart className={cn('h-4 w-4', inWishlist && 'fill-current')} />
                </button>
                <button
                  onClick={handleCompare}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border bg-card shadow-sm press-effect',
                    inCompare ? 'border-primary/40 text-primary' : 'text-foreground'
                  )}
                  aria-label="তুলনা করুন"
                >
                  <Columns2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* দাম — অ্যাপ স্টাইল বড় প্রাইস ব্লক */}
            <div className="flex flex-wrap items-end gap-2.5">
              <span className="text-3xl font-extrabold tracking-tight text-primary">{formatBDT(effectivePrice)}</span>
              {product.comparePrice && product.comparePrice > effectivePrice && (
                <>
                  <span className="text-base text-muted-foreground line-through">{formatBDT(product.comparePrice)}</span>
                  <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-bold text-destructive">
                    {toBn(discount)}% ছাড়
                  </span>
                </>
              )}
            </div>
            {product.comparePrice && product.comparePrice > effectivePrice && (
              <div className="mt-1 text-xs font-medium text-muted-foreground">
                আপনি সাশ্রয় করছেন {formatBDT(product.comparePrice - effectivePrice)} • ইউনিট: {product.unit}
              </div>
            )}
            {!product.comparePrice && <div className="mt-1 text-xs text-muted-foreground">ইউনিট: {product.unit}</div>}

            {/* টাইটেল ও ব্র্যান্ড */}
            {product.brand && <div className="mt-3 text-sm font-semibold text-primary">{product.brand.name}</div>}
            <h1 className="mt-0.5 text-lg font-bold leading-snug md:text-2xl" data-selectable>{product.nameBn || product.name}</h1>

            {/* রেটিং চিপ রো */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
                <StarRating value={reviewSummary.count ? reviewSummary.avg : product.rating} size="h-3 w-3" />
                <span className="font-semibold">{reviewSummary.count ? reviewSummary.avg : product.rating}</span>
              </span>
              <button
                onClick={() => document.getElementById('pd-reviews')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-full border bg-card px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                {toBn(reviewSummary.count || product.reviewCount)} রিভিউ
              </button>
              <span className="rounded-full border bg-card px-2.5 py-1 font-medium text-muted-foreground">
                {toBn(product.soldCount)}+ বিক্রি
              </span>
              {product.sku && (
                <span className="hidden rounded-full border bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground sm:inline">
                  SKU: {product.sku}
                </span>
              )}
            </div>

            {product.shortDescription && (
              <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm leading-relaxed" data-selectable>{product.shortDescription}</p>
            )}

            {/* রং নির্বাচন */}
            {hasVariants && colorOptions.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Palette className="h-4 w-4 text-primary" /> রং
                  {selectedColor && <span className="font-normal text-muted-foreground">— {selectedColor}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((c) => {
                    const v = variants.find((x) => x.key === buildVariantKey(c.name, selectedSize));
                    const disabled = v ? v.stock <= 0 : true;
                    const active = selectedColor === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedColor(c.name)}
                        className={cn(
                          'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all press-effect',
                          active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50',
                          disabled && 'cursor-not-allowed opacity-40'
                        )}
                        aria-pressed={active}
                      >
                        <span
                          className="h-5 w-5 rounded-full border border-black/10 shadow-inner"
                          style={{ backgroundColor: c.hex || '#ddd' }}
                          aria-hidden
                        />
                        {c.name}
                        {disabled && <span className="text-[10px] text-destructive">স্টক শেষ</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* সাইজ নির্বাচন */}
            {hasVariants && sizeOptions.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Ruler className="h-4 w-4 text-primary" /> সাইজ
                  {selectedSize && <span className="font-normal text-muted-foreground">— {selectedSize}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizeOptions.map((s) => {
                    const v = variants.find((x) => x.key === buildVariantKey(selectedColor, s));
                    const disabled = v ? v.stock <= 0 : true;
                    const active = selectedSize === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedSize(s)}
                        className={cn(
                          'min-w-12 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all press-effect',
                          active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border hover:border-primary/50 hover:bg-accent',
                          disabled && 'cursor-not-allowed text-muted-foreground/40 line-through'
                        )}
                        aria-pressed={active}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* পরিমাণ + স্টক */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center overflow-hidden rounded-full border">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-accent press-effect"
                  aria-label="পরিমাণ কমান"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-bold">{toBn(quantity)}</span>
                <button
                  onClick={() => setQuantity(Math.min(outOfStock ? 1 : effectiveStock, quantity + 1))}
                  className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-accent press-effect"
                  aria-label="পরিমাণ বাড়ান"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {outOfStock ? (
                  <span className="flex items-center gap-1.5 font-medium text-destructive">
                    <span className="h-2 w-2 rounded-full bg-destructive" /> স্টক শেষ
                  </span>
                ) : effectiveStock < 20 ? (
                  <span className="flex items-center gap-1.5 font-medium text-amber-600">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> সীমিত — মাত্র {toBn(effectiveStock)} টি
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium text-green-600">
                    <span className="h-2 w-2 rounded-full bg-green-500" /> স্টকে আছে
                  </span>
                )}
              </div>
            </div>

            {/* ডেস্কটপ অ্যাকশন বাটন */}
            <div className="mt-5 hidden gap-3 md:flex">
              <Button
                size="lg"
                className="min-w-44 flex-1 font-semibold"
                onClick={() => handleAdd(false)}
                disabled={outOfStock || adding}
              >
                {added ? <><Check className="mr-1.5 h-4 w-4" /> যোগ হয়েছে</> : <><ShoppingBag className="mr-1.5 h-4 w-4" /> কার্টে যোগ করুন</>}
              </Button>
              <Button size="lg" variant="secondary" className="font-semibold" onClick={() => handleAdd(true)} disabled={outOfStock || adding}>
                এখনই কিনুন
              </Button>
              {waLink && (
                <Button
                  size="lg"
                  variant="outline"
                  className="font-semibold text-[#128C7E] hover:bg-[#25D366]/10 hover:text-[#128C7E]"
                  onClick={() => window.open(waLink, '_blank', 'noopener')}
                >
                  <MessageCircle className="mr-1.5 h-4 w-4 fill-[#25D366]" strokeWidth={0} />
                  WhatsApp-এ অর্ডার
                </Button>
              )}
              <Button
                size="icon"
                variant="outline"
                className={cn('h-11 w-11', inWishlist && 'text-destructive')}
                onClick={() => {
                  toggleWishlist(product.id);
                  toast({ title: inWishlist ? 'উইশলিস্ট থেকে সরানো হয়েছে' : 'উইশলিস্টে যোগ হয়েছে' });
                }}
                aria-label="উইশলিস্টে যোগ করুন"
              >
                <Heart className={cn('h-5 w-5', inWishlist && 'fill-current')} />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className={cn('h-11 w-11', inCompare && 'border-primary text-primary')}
                onClick={handleCompare}
                aria-label="তুলনা করুন"
                title="তুলনা করুন"
              >
                <Columns2 className="h-5 w-5" />
              </Button>
            </div>

            {/* ট্রাস্ট রো */}
            <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border bg-card p-3 text-center">
              <div>
                <Truck className="mx-auto mb-1 h-4.5 w-4.5 text-primary" />
                <div className="text-[11px] font-medium">দ্রুত ডেলিভারি</div>
                <div className="text-[9px] text-muted-foreground">২৪-৭২ ঘন্টায়</div>
              </div>
              <div className="border-x">
                <ShieldCheck className="mx-auto mb-1 h-4.5 w-4.5 text-primary" />
                <div className="text-[11px] font-medium">১০০% অরিজিনাল</div>
                <div className="text-[9px] text-muted-foreground">নিশ্চয়তা</div>
              </div>
              <div>
                <RotateCcw className="mx-auto mb-1 h-4.5 w-4.5 text-primary" />
                <div className="text-[11px] font-medium">সহজ রিটার্ন</div>
                <div className="text-[9px] text-muted-foreground">২৪ ঘন্টায়</div>
              </div>
            </div>

            {/* ডেলিভারি সামারি */}
            {zones.length > 0 && (
              <button
                onClick={() => document.getElementById('pd-details')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-3 flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/40"
              >
                <Truck className="h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">
                    {zones.map((z) => `${z.name} ${formatBDT(z.charge)}`).join(' • ')}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {zones[0].eta} • {formatBDT(freeShippingThreshold)}+ অর্ডারে ফ্রি ডেলিভারি
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}

            {/* মেটা */}
            <div className="mt-4 space-y-0.5 text-[11px] text-muted-foreground">
              <div><span className="font-medium text-foreground">SKU:</span> {product.sku}</div>
              {product.weight && <div><span className="font-medium text-foreground">ওজন/পরিমাণ:</span> {product.weight}</div>}
              {product.origin && <div><span className="font-medium text-foreground">উৎস:</span> {product.origin}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ বিবরণ ও ডেলিভারি — অ্যাকর্ডিয়ন ═══════════ */}
      <div id="pd-details" className="mx-auto max-w-7xl scroll-mt-20 px-4">
        <Accordion type="multiple" defaultValue={['pd-desc', 'pd-ship']} className="mt-6">
          <AccordionItem value="pd-desc" className="rounded-xl border bg-card px-4 data-[state=open]:bg-card">
            <AccordionTrigger className="text-sm font-bold">বিস্তারিত বিবরণ</AccordionTrigger>
            <AccordionContent>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground" data-selectable>
                {product.description}
              </p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="pd-ship" className="mt-2 rounded-xl border bg-card px-4">
            <AccordionTrigger className="text-sm font-bold">ডেলিভারি ও রিটার্ন</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {zones.map((z) => (
                  <li key={z.id} className="flex gap-2">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      {z.name}: ডেলিভারি চার্জ {formatBDT(z.charge)} ({z.eta}
                      {z.freeShippingOver ? ` — ${formatBDT(z.freeShippingOver)}+ অর্ডারে ফ্রি` : ''})
                    </span>
                  </li>
                ))}
                <li className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-primary" /> পণ্য হাতে পেয়ে চেক করে টাকা দেওয়ার সুযোগ (COD)</li>
                <li className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-primary" /> পণ্যে সমস্যা থাকলে ২৪ ঘন্টার মধ্যে জানালে রিটার্ন/রিপ্লেসমেন্ট</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* ═══════════ রেটিং ও রিভিউ ═══════════ */}
      <section id="pd-reviews" className="mx-auto mt-6 max-w-7xl scroll-mt-20 px-4">
        <div className="rounded-xl border bg-card">
          {/* সামারি */}
          <div className="flex items-center gap-4 p-4">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-primary">{reviewSummary.count ? reviewSummary.avg : product.rating}</div>
              <StarRating value={reviewSummary.count ? reviewSummary.avg : product.rating} size="h-3.5 w-3.5" />
              <div className="mt-1 text-[11px] text-muted-foreground">{toBn(reviewSummary.count || product.reviewCount)} টি রিভিউ</div>
            </div>
            <Separator orientation="vertical" className="h-14" />
            <div className="min-w-0 flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const n = reviews.filter((r) => r.status === 'APPROVED' && r.rating === star).length;
                const pct = reviewSummary.count ? Math.round((n / reviewSummary.count) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex w-8 items-center gap-0.5">{toBn(star)}<Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /></span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right">{toBn(n)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* রিভিউ লিখুন টগল */}
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full font-semibold press-effect sm:w-auto"
              onClick={() => setReviewFormOpen((o) => !o)}
              aria-expanded={reviewFormOpen}
            >
              <Star className="mr-1.5 h-4 w-4 text-amber-400" />
              {reviewFormOpen ? 'ফর্ম বন্ধ করুন' : 'রিভিউ লিখুন'}
            </Button>

            {reviewFormOpen && (
              <div className="mt-4 grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">রেটিং</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                        aria-label={`${star} স্টার`}
                        type="button"
                      >
                        <Star
                          className={cn(
                            'h-7 w-7 transition-colors',
                            star <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30 hover:text-amber-300'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">আপনার নাম</label>
                  <Input
                    value={reviewForm.name}
                    onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
                    placeholder="নাম লিখুন"
                    disabled={!!user}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">মতামত</label>
                  <Textarea
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    placeholder="পণ্যটি সম্পর্কে আপনার অভিজ্ঞতা লিখুন..."
                    rows={3}
                  />
                </div>
                {/* রিভিউতে ছবি (সর্বোচ্চ ৩টি) */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">ছবি যোগ করুন (ঐচ্ছিক, সর্বোচ্চ ৩টি)</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {reviewImages.map((img, i) => (
                      <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border">
                        <img src={img} alt={`রিভিউ ছবি ${i + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setReviewImages((imgs) => imgs.filter((_, j) => j !== i))}
                          className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
                          aria-label="ছবি সরান"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {reviewImages.length < 3 && (
                      <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                        {uploadingReviewImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4" /><span className="text-[9px]">ছবি</span></>}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void addReviewImage(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Button className="w-full font-semibold sm:w-40" onClick={submitReview} disabled={submittingReview}>
                    {submittingReview ? 'জমা হচ্ছে...' : 'রিভিউ জমা দিন'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* রিভিউ লিস্ট */}
          <div className="divide-y">
            {reviews.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                এখনো কোনো রিভিউ নেই। প্রথম রিভিউটি আপনিই দিন!
              </div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {r.name[0]}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                          {r.name}
                          {r.verifiedPurchase && (
                            <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
                              <BadgeCheck className="h-2.5 w-2.5" /> ভেরিফায়েড ক্রয়
                            </span>
                          )}
                          {r.status === 'PENDING' && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              পর্যালোচনাধীন
                            </span>
                          )}
                        </div>
                        <StarRating value={r.rating} size="h-3 w-3" />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString('bn-BD')}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm text-muted-foreground" data-selectable>{r.comment}</p>
                  {/* রিভিউ ছবি (থাকলে) — ক্লিকে লাইটবক্স */}
                  {(() => {
                    const imgs = Array.isArray(r.images) ? r.images : r.image ? [r.image] : [];
                    if (!imgs.length) return null;
                    return (
                      <div className="mt-2 flex gap-2">
                        {imgs.map((img, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setLightbox(img)}
                            className="h-16 w-16 overflow-hidden rounded-lg border transition-transform hover:scale-[1.04]"
                            aria-label="রিভিউ ছবি বড় করে দেখুন"
                          >
                            <img src={img} alt={`রিভিউ ছবি ${i + 1}`} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    );
 })()}
                  {r.status === 'APPROVED' && (
                    <button
                      onClick={() => handleHelpful(r.id)}
                      className="mt-2 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      aria-label="সহায়ক রিভিউ"
                    >
                      <ThumbsUp className="h-3 w-3" /> সহায়ক ({toBn(r.helpfulCount)})
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ সম্পর্কিত পণ্য — মোবাইলে হরাইজন্টাল স্ন্যাপ, ডেস্কটপে গ্রিড ═══════════ */}
      {related.length > 0 && (
        <section className="mt-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
            <h2 className="text-base font-bold md:text-lg">সম্পর্কিত পণ্য</h2>
            <button
              onClick={() => navigate({ name: 'shop', category: product.category?.slug })}
              className="flex items-center gap-0.5 text-xs font-semibold text-primary"
            >
              সব দেখুন <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* মোবাইল — হরাইজন্টাল স্ক্রল */}
          <div className="mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 no-scrollbar md:hidden">
            {related.slice(0, 8).map((p) => (
              <div key={p.id} className="w-40 shrink-0 snap-start">
                <ProductCard product={p} compact />
              </div>
            ))}
          </div>
          {/* ডেস্কটপ — গ্রিড */}
          <div className="mx-auto mt-4 hidden max-w-7xl grid-cols-4 gap-4 px-4 md:grid xl:grid-cols-5">
            {related.slice(0, 5).map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ স্টিকি বটম অ্যাকশন বার — মোবাইল (বটম নেভের ঠিক উপরে) ═══════════ */}
      <div
        className="pd-actionbar fixed inset-x-0 bottom-[calc(54px+env(safe-area-inset-bottom))] z-40 border-t bg-background/95 px-3 py-2.5 backdrop-blur md:hidden"
        role="region"
        aria-label="কেনাকাটার অ্যাকশন"
      >
        <div className="flex items-center gap-2.5">
          <div className="hidden min-w-[76px] flex-col leading-tight min-[400px]:flex">
            <span className="text-[10px] text-muted-foreground">মোট মূল্য</span>
            <span className="text-sm font-extrabold text-primary">{formatBDT(totalPrice)}</span>
          </div>
          <Button
            variant="outline"
            className="h-11 flex-1 font-semibold press-effect"
            onClick={() => handleAdd(false)}
            disabled={outOfStock || adding}
          >
            {added ? <Check className="mr-1.5 h-4 w-4" /> : <ShoppingBag className="mr-1.5 h-4 w-4" />}
            {added ? 'যোগ হয়েছে' : 'কার্টে যোগ'}
          </Button>
          {waLink ? (
            <>
              <Button
                variant="outline"
                className="h-11 w-11 shrink-0 p-0 text-[#128C7E]"
                onClick={() => window.open(waLink, '_blank', 'noopener')}
                aria-label="WhatsApp-এ অর্ডার করুন"
                title="WhatsApp-এ অর্ডার করুন"
              >
                <MessageCircle className="h-5 w-5 fill-[#25D366]" strokeWidth={0} />
              </Button>
              <Button
                className="h-11 flex-1 font-semibold press-effect"
                onClick={() => handleAdd(true)}
                disabled={outOfStock || adding}
              >
                এখনই কিনুন
              </Button>
            </>
          ) : (
            <Button
              className="h-11 flex-1 font-semibold press-effect"
              onClick={() => handleAdd(true)}
              disabled={outOfStock || adding}
            >
              এখনই কিনুন
            </Button>
          )}
        </div>
      </div>

      {/* ═══════════ রিভিউ ছবি লাইটবক্স ═══════════ */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="রিভিউ ছবি"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="রিভিউ ছবি বড় আকারে" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
          <button
            type="button"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black"
            aria-label="বন্ধ করুন"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

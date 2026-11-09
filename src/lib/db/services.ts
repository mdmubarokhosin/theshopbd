/**
 * THE SHOP BD — সার্ভিস লেয়ার (সব বিজনেস লজিক এখানে)
 * ---------------------------------------------------------------------------
 * UI কোনোভাবেই localStorage সরাসরি পড়ে না — এই সার্ভিস ফাংশনগুলো ব্যবহার করে।
 * ভবিষ্যতে রিয়েল ব্যাকএন্ড যোগ করতে: এই ফাংশনগুলো fetch('/api/...') কলে বদলান।
 * ফাংশন সিগনেচারগুলো REST API-র সাথে ১:১ মিলিয়ে ডিজাইন করা (docs/FUTURE-BACKEND.md)।
 */
import { db, uid, orderNumber as genOrderNumber } from './core';
import {
  getCurrentUser, isAdminUser, cartKeyFor, can,
} from './auth';
import type {
  Product, ProductVariant, Category, Brand, Review, Order, OrderItem, OrderStatus,
  PaymentTransaction, Coupon, DeliveryZone, PaymentMethod, ReturnRequest,
  StockMovement, Expense, Notification, SupportTicket, Subscriber, MediaItem,
  AuditLog, User, Role, Permission, SiteSettings, CmsPage, Slide, SideBanner,
  WhyUsItem, Testimonial, OrderStatusEvent, PaymentStatus, Announcement, ProductPerk,
} from './types';
import {
  syncAbandonedCart, markCartRecovered, redeemLoyalty, awardLoyaltyForOrder,
  creditReferralForOrder, sendOrderSms, loyaltyBalanceOf, loyaltyPointValue, loyaltyMaxRedeemPoints,
} from './growth';

// ═══════════════════════════ ক্যাটালগ ═══════════════════════════

/** ক্যাটাগরি ট্রি (parent → children নেস্ট করা) */
export function categoryTree(): (Category & { children: Category[] })[] {
  const all = db.collection('categories');
  // রিকার্সিভ ট্রি — nested সাব-ক্যাটাগরি (যেমন ফ্যাশন → ছেলেদের পোশাক → পাঞ্জাবি)
  const build = (parentId: string | null): (Category & { children: Category[] })[] =>
    all
      .filter((c) => (parentId === null ? !c.parentId : c.parentId === parentId))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((c) => ({ ...c, children: build(c.id) }));
  return build(null);
}

export function allCategoriesFlat(): Category[] {
  return db.collection('categories');
}

export function categoryBySlug(slug: string): Category | undefined {
  return db.collection('categories').find((c) => c.slug === slug);
}

export function brandsList(): Brand[] {
  return db.collection('brands');
}

export function brandBySlug(slug: string): Brand | undefined {
  return db.collection('brands').find((b) => b.slug === slug);
}

export function productById(id: string): Product | undefined {
  return db.findById('products', id);
}

export function productBySlug(slug: string): Product | undefined {
  return db.collection('products').find((p) => p.slug === slug);
}

/** প্রোডাক্ট + ক্যাটাগরি/ব্র্যান্ড জয়েন */
export function decorate(p: Product): Product & { category?: Category; brand?: Brand | null } {
  return {
    ...p,
    category: db.findById('categories', p.categoryId),
    brand: p.brandId ? db.findById('brands', p.brandId) ?? null : null,
  };
}

export type ProductQuery = {
  search?: string;
  category?: string;      // slug
  brand?: string;         // slug
  featured?: boolean;
  bestseller?: boolean;
  isNew?: boolean;
  offers?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  sort?: 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'bestselling';
  page?: number;
  limit?: number;
};

export function queryProducts(q: ProductQuery = {}): { products: Product[]; total: number } {
  let list = db.collection('products').filter((p) => p.active);

  if (q.category) {
    const cat = categoryBySlug(q.category);
    if (cat) {
      // সব descendant (nested সাব-ক্যাটাগরিসহ) — রিকার্সিভ
      const allCats = db.collection('categories');
      const desc = new Set<string>();
      const collect = (id: string) => {
        for (const c of allCats) {
          if (c.parentId === id && !desc.has(c.id)) {
            desc.add(c.id);
            collect(c.id);
          }
        }
      };
      collect(cat.id);
      list = list.filter((p) => p.categoryId === cat.id || desc.has(p.categoryId));
    }
  }
  if (q.brand) {
    const b = brandBySlug(q.brand);
    if (b) list = list.filter((p) => p.brandId === b.id);
  }
  if (q.featured) list = list.filter((p) => p.isFeatured);
  if (q.bestseller) list = list.filter((p) => p.isBestSeller);
  if (q.isNew) list = list.filter((p) => p.isNew);
  if (q.offers) list = list.filter((p) => !!p.comparePrice && p.comparePrice > p.price);
  if (q.inStock) list = list.filter((p) => p.stock > 0);
  if (q.minPrice != null) list = list.filter((p) => p.price >= q.minPrice!);
  if (q.maxPrice != null) list = list.filter((p) => p.price <= q.maxPrice!);
  if (q.rating != null) list = list.filter((p) => p.rating >= q.rating!);
  if (q.search) {
    const s = q.search.toLowerCase();
    list = list.filter((p) => {
      const brand = p.brandId ? db.findById('brands', p.brandId) : null;
      return (
        p.name.toLowerCase().includes(s) ||
        p.nameBn?.toLowerCase().includes(s) ||
        p.slug.includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        p.shortDescription?.toLowerCase().includes(s) ||
        brand?.name.toLowerCase().includes(s)
      );
    });
  }

  const sorted = [...list];
  switch (q.sort) {
    case 'newest': sorted.sort((a, b) => (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1)); break;
    case 'price_asc': sorted.sort((a, b) => a.price - b.price); break;
    case 'price_desc': sorted.sort((a, b) => b.price - a.price); break;
    case 'rating': sorted.sort((a, b) => b.rating - a.rating); break;
    case 'bestselling': sorted.sort((a, b) => b.soldCount - a.soldCount); break;
    default: sorted.sort((a, b) => b.soldCount - a.soldCount);
  }

  const total = sorted.length;
  const page = q.page || 1;
  const limit = q.limit || 0;
  const products = limit > 0 ? sorted.slice((page - 1) * limit, page * limit) : sorted;
  return { products, total };
}

export function searchSuggestions(q: string, limit = 8): { name: string; slug: string; image: string | null; price: number }[] {
  if (!q.trim()) return [];
  const { products } = queryProducts({ search: q, limit });
  return products.map((p) => ({
    name: p.nameBn || p.name,
    slug: p.slug,
    image: safeImages(p)[0] || null,
    price: p.price,
  }));
}

export function relatedProducts(product: Product, limit = 6): Product[] {
  return db
    .collection('products')
    .filter((p) => p.active && p.id !== product.id && p.categoryId === product.categoryId)
    .slice(0, limit);
}

export function safeImages(p: { images: string }): string[] {
  try {
    const arr = JSON.parse(p.images);
    return Array.isArray(arr) ? arr : [p.images];
  } catch {
    return [p.images];
  }
}

/** রিভিউ যোগ ও রেটিং রি-ক্যালকুলেশন */
export function addReview(input: { productId: string; name: string; rating: number; comment: string; userId?: string | null; image?: string | null; images?: string[] }): Review {
  const user = getCurrentUser();
  let verified = false;
  if (input.userId || user) {
    const uidv = input.userId || user!.id;
    verified = db.collection('orders').some(
      (o) =>
        o.userId === uidv &&
        ['DELIVERED', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.status) &&
        o.items.some((i) => {
          const p = productBySlug(i.productSlug);
          return p?.id === input.productId;
        })
    );
  }
  const review: Review = {
    id: uid('rev'),
    productId: input.productId,
    userId: input.userId ?? user?.id ?? null,
    name: input.name,
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    comment: input.comment,
    image: input.image ?? null,
    images: Array.isArray(input.images) ? input.images.slice(0, 3) : [],
    verifiedPurchase: verified,
    helpfulCount: 0,
    status: 'PENDING', // অ্যাডমিন মডারেশন
    adminReply: null,
    createdAt: new Date().toISOString(),
  };
  db.append('reviews', review);
  return review;
}

export function approvedReviews(productId: string): Review[] {
  return db
    .collection('reviews')
    .filter((r) => r.productId === productId && r.status === 'APPROVED')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function recalcProductRating(productId: string): void {
  const product = productById(productId);
  if (!product) return;
  const revs = approvedReviews(productId);
  const count = revs.length;
  const rating = count ? Math.round((revs.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : product.rating;
  db.put('products', { ...product, reviewCount: count, rating });
}

export function markReviewHelpful(reviewId: string): void {
  const r = db.findById('reviews', reviewId);
  if (r) db.put('reviews', { ...r, helpfulCount: r.helpfulCount + 1 });
}

// ═══════════════════════════ কার্ট (localStorage) ═══════════════════════════

export type CartLine = {
  productId: string;
  variantKey: string;
  quantity: number;
};

export type HydratedCartItem = {
  productId: string;
  variantKey: string;
  quantity: number;
  product: Product;
  variant: ProductVariant | null;
  unitPrice: number;
  lineTotal: number;
  image: string | null;
};

function readCartLines(): CartLine[] {
  const user = getCurrentUser();
  const key = cartKeyFor(user?.id ?? null);
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function writeCartLines(lines: CartLine[]): void {
  const user = getCurrentUser();
  localStorage.setItem(cartKeyFor(user?.id ?? null), JSON.stringify(lines));
  window.dispatchEvent(new Event('tsb:cart'));
}

/** কার্ট লাইন + লাইভ প্রোডাক্ট ডেটা (প্রাইস/স্টক রিভ্যালিডেশন বিল্ট-ইন) */
export function getCart(): { items: HydratedCartItem[]; subtotal: number; count: number } {
  if (typeof window === 'undefined') return { items: [], subtotal: 0, count: 0 };
  const lines = readCartLines();
  const items: HydratedCartItem[] = [];
  for (const line of lines) {
    const product = productById(line.productId);
    if (!product || !product.active) continue;
    const variant =
      line.variantKey && product.variants?.length
        ? product.variants.find((v) => v.key === line.variantKey) ?? null
        : null;
    const unitPrice = variant ? variant.price : product.price;
    const capped = Math.min(line.quantity, variant ? variant.stock : product.stock);
    if (capped <= 0) continue;
    items.push({
      productId: line.productId,
      variantKey: line.variantKey,
      quantity: capped,
      product,
      variant,
      unitPrice,
      lineTotal: unitPrice * capped,
      image: variant?.image || safeImages(product)[0] || null,
    });
  }
  return {
    items,
    subtotal: items.reduce((s, i) => s + i.lineTotal, 0),
    count: items.reduce((s, i) => s + i.quantity, 0),
  };
}

export function addToCart(productId: string, quantity = 1, variantKey = ''): { ok: boolean; error?: string } {
  const product = productById(productId);
  if (!product || !product.active) return { ok: false, error: 'পণ্যটি পাওয়া যায়নি' };
  const variant = variantKey && product.variants?.length ? product.variants.find((v) => v.key === variantKey) : null;
  const stock = variant ? variant.stock : product.stock;
  if (stock <= 0) return { ok: false, error: 'পণ্যটি স্টকে নেই' };

  const lines = readCartLines();
  const existing = lines.find((l) => l.productId === productId && l.variantKey === variantKey);
  const newQty = Math.min((existing?.quantity || 0) + quantity, stock);
  if (existing) existing.quantity = newQty;
  else lines.push({ productId, variantKey, quantity: Math.min(quantity, stock) });
  writeCartLines(lines);
  syncAbandonedCart(); // অ্যাব্যান্ডন্ড কার্ট ট্র্যাকিং (ডিবাউন্সড)
  return { ok: true };
}

export function updateCartQty(productId: string, quantity: number, variantKey = ''): void {
  let lines = readCartLines();
  if (quantity <= 0) lines = lines.filter((l) => !(l.productId === productId && l.variantKey === variantKey));
  else
    lines = lines.map((l) =>
      l.productId === productId && l.variantKey === variantKey ? { ...l, quantity } : l
    );
  writeCartLines(lines);
  syncAbandonedCart();
}

export function removeFromCart(productId: string, variantKey = ''): void {
  updateCartQty(productId, 0, variantKey);
}

export function clearCart(): void {
  writeCartLines([]);
  syncAbandonedCart();
}

/** লাইন সরিয়ে উইশলিস্টে পাঠানোর জন্য (UI উইশলিস্ট টগল করে) */
export function moveLineToWishlist(productId: string, variantKey: string): void {
  removeFromCart(productId, variantKey);
}

// ═══════════════════════════ কুপন ═══════════════════════════

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number; freeShipping: boolean; message: string }
  | { ok: false; error: string };

export function validateCoupon(code: string, subtotal: number): CouponResult {
  const coupon = db
    .collection('coupons')
    .find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
  if (!coupon || !coupon.active) return { ok: false, error: 'কুপন কোডটি সঠিক নয়' };
  const now = Date.now();
  if (coupon.startAt && new Date(coupon.startAt).getTime() > now) return { ok: false, error: 'কুপনটি এখনো চালু হয়নি' };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return { ok: false, error: 'কুপনটির মেয়াদ শেষ' };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { ok: false, error: 'কুপনটির ব্যবহার সীমা শেষ' };
  if (subtotal < coupon.minOrder) {
    return { ok: false, error: `এই কুপনে সর্বনিম্ন ৳${coupon.minOrder} অর্ডার প্রয়োজন` };
  }
  if (coupon.firstOrderOnly) {
    const user = getCurrentUser();
    const hasOrders = db.collection('orders').some((o) => (user ? o.userId === user.id : false));
    if (hasOrders) return { ok: false, error: 'এই কুপন শুধু প্রথম অর্ডারের জন্য' };
  }

  let discount = 0;
  let freeShipping = false;
  if (coupon.type === 'percent') {
    discount = Math.round((subtotal * coupon.value) / 100);
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else if (coupon.type === 'fixed') {
    discount = Math.min(coupon.value, subtotal);
  } else {
    freeShipping = true;
  }
  return {
    ok: true,
    coupon,
    discount,
    freeShipping,
    message: coupon.type === 'free_shipping' ? 'ফ্রি ডেলিভারি প্রয়োগ হয়েছে' : `কুপন প্রয়োগ হয়েছে — সাশ্রয় ৳${discount}`,
  };
}

// ═══════════════════════════ ডেলিভারি ═══════════════════════════

export function deliveryZones(): DeliveryZone[] {
  return db.collection('deliveryZones').filter((z) => z.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function paymentMethodsList(onlyActive = true): PaymentMethod[] {
  const builtIn = db.collection('paymentMethods');
  const custom = db.collection('customGateways');
  // কাস্টম গেটওয়ে (অ্যাডমিন-সংজ্ঞায়িত) চেকআউটের তালিকায় একইভাবে দেখায়
  const all: PaymentMethod[] = [...builtIn, ...custom.map((g) => ({ ...g, type: 'mobile_banking' as const }))];
  return onlyActive ? all.filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder) : all;
}

export function calcShipping(zoneId: string | null, subtotal: number, freeShippingCoupon = false): { charge: number; zone: DeliveryZone | null } {
  if (freeShippingCoupon) return { charge: 0, zone: null };
  const zone = zoneId ? db.findById('deliveryZones', zoneId) : deliveryZones()[0] || null;
  if (!zone) return { charge: 0, zone: null };
  if (zone.freeShippingOver && subtotal >= zone.freeShippingOver) return { charge: 0, zone };
  return { charge: zone.charge, zone };
}

// ═══════════════════════════ অর্ডার তৈরি ও ট্র্যাকিং ═══════════════════════════

export type PlaceOrderInput = {
  customerName: string;
  phone: string;
  email?: string | null;
  address: string;
  district: string;
  city: string;
  area?: string | null;
  zoneId: string | null;
  paymentMethodId: string;
  trxId?: string | null;
  senderNumber?: string | null;
  couponCode?: string | null;
  note?: string | null;
  saveAddress?: boolean;
  usePoints?: number;             // লয়ালটি পয়েন্ট খরচ (লগইন ইউজার)
  paymentMethodNameOverride?: string; // অনলাইন গেটওয়ের জন্য নাম
};

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string };

/** অর্ডার তৈরি — প্রাইস/স্টক সার্ভার-সাইড যাচাই (এখানে সার্ভিস লেয়ার = সার্ভার সমতুল্য) */
export function placeOrder(input: PlaceOrderInput): PlaceOrderResult {
  const user = getCurrentUser();
  const cart = getCart();
  if (!cart.items.length) return { ok: false, error: 'কার্ট খালি' };

  const isGateway = input.paymentMethodId?.startsWith('gateway_');
  const method: PaymentMethod | undefined = isGateway
    ? {
        id: input.paymentMethodId,
        name: input.paymentMethodNameOverride || 'অনলাইন পেমেন্ট',
        type: input.paymentMethodId === 'gateway_sslcz' ? 'card' : 'mobile_banking',
        logo: null,
        accountNumber: null,
        instructions: null,
        needsTrxId: false,
        active: true,
        sortOrder: 0,
      }
    : db.findById('paymentMethods', input.paymentMethodId);
  if (!method || !method.active) return { ok: false, error: 'পেমেন্ট মেথড নির্বাচন করুন' };
  if (method.needsTrxId && !input.trxId?.trim()) {
    return { ok: false, error: `${method.name}-এর Transaction ID দিন` };
  }

  // মিনিমাম অর্ডার যাচাই
  const minOrder = Number(db.get().settings.min_order_amount) || 0;
  if (minOrder > 0 && cart.subtotal < minOrder) {
    return { ok: false, error: `সর্বনিম্ন অর্ডার মূল্য ৳${minOrder}` };
  }

  // কুপন যাচাই (সার্ভার-সাইড)
  let discount = 0;
  let freeShipping = false;
  let appliedCoupon: Coupon | null = null;
  if (input.couponCode) {
    const res = validateCoupon(input.couponCode, cart.subtotal);
    if (!res.ok) return { ok: false, error: res.error };
    appliedCoupon = res.coupon;
    discount = res.discount;
    freeShipping = res.freeShipping;
  }

  // স্টক পুনঃযাচাই
  for (const item of cart.items) {
    const stock = item.variant ? item.variant.stock : item.product.stock;
    if (item.quantity > stock) {
      return { ok: false, error: `${item.product.nameBn || item.product.name} — স্টক যথেষ্ট নেই (বর্তমানে ${stock})` };
    }
  }

  const { charge: shipping } = calcShipping(input.zoneId, cart.subtotal, freeShipping);

  // ট্যাক্স
  const s = db.get().settings;
  let tax = 0;
  if (s.tax_enabled === '1' && s.tax_inclusive !== '1') {
    tax = Math.round((cart.subtotal * (Number(s.tax_percent) || 0)) / 100);
  }

  const total = Math.max(0, cart.subtotal - discount + shipping + tax);
  const num = genOrderNumber();
  const now = new Date().toISOString();

  // ── লয়ালটি পয়েন্ট খরচ (লগইন ইউজার + সেটিং চালু) ──
  const loyaltyOn = s.loyalty_enabled === '1';
  let pointsUsed = 0;
  let pointsDiscount = 0;
  if (loyaltyOn && user && input.usePoints && input.usePoints > 0) {
    const balance = loyaltyBalanceOf(user.id);
    const maxPts = loyaltyMaxRedeemPoints(Math.max(0, cart.subtotal - discount) + shipping + tax);
    pointsUsed = Math.min(Math.floor(input.usePoints), balance, maxPts);
    const pv = loyaltyPointValue();
    pointsDiscount = Math.round(pointsUsed * pv);
    if (pointsDiscount > cart.subtotal - discount + shipping + tax) {
      pointsDiscount = cart.subtotal - discount + shipping + tax;
    }
  }
  const finalTotal = Math.max(0, total - pointsDiscount);

  const items: OrderItem[] = cart.items.map((i) => ({
    id: uid('oi'),
    productName: i.product.nameBn || i.product.name,
    productSlug: i.product.slug,
    variantName: i.variant ? [i.variant.color, i.variant.size].filter(Boolean).join(', ') || null : null,
    variantKey: i.variantKey || null,
    image: i.image ?? null,
    price: i.unitPrice,
    unitPrice: i.unitPrice,
    sku: i.product.sku,
    quantity: i.quantity,
  }));

  const order: Order = {
    id: uid('ord'),
    orderNumber: num,
    userId: user?.id ?? null,
    customerName: input.customerName,
    phone: input.phone,
    email: input.email ?? user?.email ?? null,
    address: input.address,
    district: input.district,
    city: input.city,
    area: input.area ?? null,
    zoneId: input.zoneId,
    items,
    subtotal: cart.subtotal,
    shipping,
    discount,
    tax: tax || undefined,
    total: finalTotal,
    loyaltyPointsUsed: pointsUsed || undefined,
    loyaltyDiscount: pointsDiscount || undefined,
    couponCode: appliedCoupon?.code ?? null,
    paymentMethodId: method.id,
    paymentMethodName: method.name,
    paymentType: method.type,
    paymentStatus: 'PENDING',
    transaction:
      method.type !== 'cod'
        ? { trxId: input.trxId ?? null, senderNumber: input.senderNumber ?? null, verifiedAt: null, verifiedBy: null, refundedAmount: 0 }
        : null,
    status: 'PENDING',
    statusHistory: [{ status: 'PENDING', at: now, note: 'অর্ডার গৃহীত হয়েছে', by: 'system' }],
    courierId: null,
    courierName: null,
    trackingNumber: null,
    note: input.note ?? null,
    adminNote: null,
    estimatedDelivery: null,
    createdAt: now,
    updatedAt: now,
  };

  // ── স্টক ডিডাকশন + মুভমেন্ট রেকর্ড (atomic: এক রাইটে সব) ──
  const products = db.collection('products');
  const movements: StockMovement[] = [];
  const updatedProducts = products.map((p) => {
    const line = cart.items.find((i) => i.productId === p.id);
    if (!line) return p;
    const vKey = line.variantKey;
    let next: Product = { ...p };
    if (vKey && next.variants?.length) {
      next.variants = next.variants.map((v) =>
        v.key === vKey ? { ...v, stock: Math.max(0, v.stock - line.quantity) } : v
      );
      next.stock = next.variants.reduce((sum, v) => sum + v.stock, 0);
    } else {
      next.stock = Math.max(0, p.stock - line.quantity);
    }
    next.soldCount = p.soldCount + line.quantity;
    movements.push({
      id: uid('stk'),
      productId: p.id,
      productName: p.nameBn || p.name,
      type: 'out',
      quantity: line.quantity,
      note: 'অর্ডারে বিক্রয়',
      ref: num,
      createdAt: now,
    });
    return next;
  });

  // ── একসাথে সব রাইট (single persist) ──
  const d = db.get();
  const transactions: PaymentTransaction[] =
    method.type !== 'cod'
      ? [
          {
            id: uid('trx'),
            orderNumber: num,
            methodId: method.id,
            methodName: method.name,
            amount: finalTotal,
            trxId: input.trxId ?? null,
            senderNumber: input.senderNumber ?? null,
            status: 'PENDING',
            verifiedAt: null,
            verifiedBy: null,
            note: null,
            createdAt: now,
          },
          ...d.transactions,
        ]
      : d.transactions;

  const couponUsed = appliedCoupon
    ? d.coupons.map((c) => (c.id === appliedCoupon!.id ? { ...c, usedCount: c.usedCount + 1 } : c))
    : d.coupons;

  const notification: Notification = {
    id: uid('ntf'),
    userId: user?.id ?? null,
    title: 'অর্ডার নিশ্চিত হয়েছে',
    message: `আপনার অর্ডার ${num} গৃহীত হয়েছে। মোট ৳${finalTotal}।`,
    type: 'order',
    read: false,
    link: null,
    createdAt: now,
  };

  db.writeBulk?.({
    products: updatedProducts,
    orders: [order, ...d.orders],
    transactions,
    coupons: couponUsed,
    stockMovements: [...movements, ...d.stockMovements],
    notifications: [notification, ...d.notifications],
  });

  // কার্ট খালি
  clearCart();

  // লয়ালটি পয়েন্ট খরচ (লেজার এন্ট্রি — অর্ডার সফল)
  if (pointsUsed > 0 && user) {
    redeemLoyalty(user, pointsUsed, num);
  }

  // অ্যাব্যান্ডন্ড কার্ট স্ন্যাপশট → recovered
  markCartRecovered();

  // কনফার্মেশন SMS (কাস্টমার + ঐচ্ছিক অ্যাডমিন) — ফায়ার-অ্যান্ড-ফরগেট
  sendOrderSms(order, 'order');

  // ঠিকানা সেভ (লগইন করা থাকলে)
  if (user && input.saveAddress) {
    import('./auth').then(({ saveAddress }) => {
      saveAddress({
        userId: user.id,
        label: 'হোম',
        name: input.customerName,
        phone: input.phone,
        district: input.district,
        city: input.city,
        area: input.area || '',
        fullAddress: input.address,
        isDefaultShipping: false,
        isDefaultBilling: false,
      });
    });
  }

  return { ok: true, order };
}

export function ordersOfUser(userId: string): Order[] {
  return db.collection('orders').filter((o) => o.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function allOrders(): Order[] {
  return [...db.collection('orders')].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function orderByNumber(num: string): Order | undefined {
  return db.collection('orders').find((o) => o.orderNumber.toLowerCase() === num.trim().toLowerCase());
}

/** অর্ডার ট্র্যাকিং (লগইন ছাড়াই অর্ডার নাম্বার + ফোনের শেষ ৪ ডিজিট বা সরাসরি) */
export function trackOrder(num: string, phoneLast4?: string): { ok: boolean; error?: string; order?: Order } {
  const order = orderByNumber(num);
  if (!order) return { ok: false, error: 'এই নাম্বারে কোনো অর্ডার পাওয়া যায়নি' };
  if (phoneLast4 && !order.phone.replace(/\D/g, '').endsWith(phoneLast4.replace(/\D/g, ''))) {
    return { ok: false, error: 'ফোন নম্বর মিলছে না' };
  }
  return { ok: true, order };
}

/** বৈধ স্ট্যাটাস ট্রানজিশন ম্যাট্রিক্স */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  FAILED_DELIVERY: ['SHIPPED', 'RETURNED', 'CANCELLED'],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
};

export const ORDER_STATUS_BN_FULL: Record<OrderStatus, string> = {
  PENDING: 'অপেক্ষমাণ',
  CONFIRMED: 'নিশ্চিত',
  PROCESSING: 'প্রস্তুত হচ্ছে',
  PACKED: 'প্যাক করা হয়েছে',
  SHIPPED: 'কুরিয়ারে পাঠানো হয়েছে',
  OUT_FOR_DELIVERY: 'ডেলিভারির পথে',
  DELIVERED: 'ডেলিভারি সম্পন্ন',
  CANCELLED: 'বাতিল',
  FAILED_DELIVERY: 'ডেলিভারি ব্যর্থ',
  RETURNED: 'ফেরত এসেছে',
  REFUNDED: 'রিফান্ড সম্পন্ন',
};

/** অ্যাডমিন: স্ট্যাটাস পরিবর্তন + ইতিহাস + নোটিফিকেশন + স্টক রিলিজ */
export function updateOrderStatus(
  orderId: string,
  next: OrderStatus,
  opts: { note?: string; by?: string; trackingNumber?: string; courierId?: string } = {}
): { ok: boolean; error?: string } {
  const order = db.findById('orders', orderId);
  if (!order) return { ok: false, error: 'অর্ডার পাওয়া যায়নি' };
  if (order.status === next) return { ok: true };
  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(next)) {
    return { ok: false, error: `${ORDER_STATUS_BN_FULL[order.status]} থেকে ${ORDER_STATUS_BN_FULL[next]}-তে যাওয়া যাবে না` };
  }

  const now = new Date().toISOString();
  const event: OrderStatusEvent = { status: next, at: now, note: opts.note, by: opts.by || 'admin' };
  let patch: Partial<Order> = {
    status: next,
    updatedAt: now,
    statusHistory: [...(Array.isArray(order.statusHistory) ? order.statusHistory : []), event],
  };
  if (opts.trackingNumber !== undefined) patch.trackingNumber = opts.trackingNumber;
  if (opts.courierId !== undefined) {
    const courier = db.findById('couriers', opts.courierId);
    patch.courierId = opts.courierId;
    patch.courierName = courier?.nameBn || courier?.name || null;
  }
  if (next === 'CANCELLED' || next === 'RETURNED') {
    patch.paymentStatus = next === 'CANCELLED' && order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus;
  }
  if (next === 'REFUNDED') patch.paymentStatus = 'REFUNDED';
  if (next === 'DELIVERED' && order.paymentType === 'cod') patch.paymentStatus = 'PAID';
  // লয়ালটি পয়েন্ট / রেফারেল কমিশন — ডেলিভারিতে একবারই দেওয়া হয়
  if (next === 'DELIVERED' && !order.loyaltyAwarded) patch.loyaltyAwarded = true;
  if (next === 'DELIVERED' && !order.referralCredited) patch.referralCredited = true;

  // বাতিল/ফেরতে স্টক রিলিজ
  const d = db.get();
  let products = d.products;
  let movements = d.stockMovements;
  if (next === 'CANCELLED' || next === 'RETURNED') {
    products = products.map((p) => {
      const line = order.items.find((i) => {
        const prod = productBySlug(i.productSlug);
        return prod?.id === p.id;
      });
      if (!line) return p;
      const qty = next === 'CANCELLED' ? line.quantity : line.quantity; // return: restock on approval flow separately
      let np = { ...p };
      if (line.variantKey && np.variants?.length) {
        np.variants = np.variants.map((v) => (v.key === line.variantKey ? { ...v, stock: v.stock + qty } : v));
        np.stock = np.variants.reduce((sum, v) => sum + v.stock, 0);
      } else {
        np.stock = p.stock + qty;
      }
      movements = [
        {
          id: uid('stk'),
          productId: p.id,
          productName: p.nameBn || p.name,
          type: 'in',
          quantity: qty,
          note: next === 'CANCELLED' ? 'অর্ডার বাতিল — স্টক রিলিজ' : 'ফেরত গৃহীত — স্টকে যোগ',
          ref: order.orderNumber,
          createdAt: now,
        },
        ...movements,
      ];
      return np;
    });
  }

  const notification: Notification = {
    id: uid('ntf'),
    userId: order.userId ?? null,
    title: 'অর্ডার আপডেট',
    message: `অর্ডার ${order.orderNumber}: ${ORDER_STATUS_BN_FULL[next]}${opts.note ? ` — ${opts.note}` : ''}`,
    type: 'shipment',
    read: false,
    link: null,
    createdAt: now,
  };

  db.writeBulk?.({
    products,
    orders: d.orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
    stockMovements: movements,
    notifications: [notification, ...d.notifications],
  });

  db.append('auditLogs', {
    id: uid('aud'),
    actor: opts.by || 'admin',
    actorId: null,
    action: 'order.status_change',
    entity: 'order',
    entityId: order.orderNumber,
    details: `${ORDER_STATUS_BN_FULL[order.status]} → ${ORDER_STATUS_BN_FULL[next]}${opts.note ? ` (${opts.note})` : ''}`,
    createdAt: now,
  });

  // ── গ্রোথ হুকস (ফায়ার-অ্যান্ড-ফরগেট, কখনো ফ্লো আটকায় না) ──
  try {
    const updatedOrder = { ...order, ...patch } as Order;
    if (next === 'DELIVERED') {
      if (updatedOrder.loyaltyAwarded && updatedOrder.userId) {
        const earned = awardLoyaltyForOrder(updatedOrder);
        if (earned && d.users.length) {
          // ইউজার নোটিফিকেশন
          db.append('notifications', {
            id: uid('ntf'),
            userId: updatedOrder.userId,
            title: 'পয়েন্ট অর্জিত হয়েছে 🎉',
            message: `অর্ডার ${updatedOrder.orderNumber} ডেলিভারির জন্য ${earned.points} পয়েন্ট পেয়েছেন।`,
            type: 'system',
            read: false,
            link: null,
            createdAt: now,
          });
        }
      }
      if (updatedOrder.referralCredited) {
        const refRes = creditReferralForOrder(updatedOrder);
        if (refRes) {
          db.append('notifications', {
            id: uid('ntf'),
            userId: refRes.referrerId,
            title: 'রেফারেল কমিশন পেয়েছেন 💰',
            message: `আপনার রেফার করা ক্রেতার অর্ডার ${updatedOrder.orderNumber} ডেলিভারি হয়েছে — কমিশন ৳${refRes.commission} যোগ হয়েছে।`,
            type: 'system',
            read: false,
            link: null,
            createdAt: now,
          });
        }
      }
    }
    // স্ট্যাটাস আপডেট SMS (চালু থাকলে)
    sendOrderSms(updatedOrder, 'status', next);
  } catch {
    // গ্রোথ ফিচার ব্যর্থ হলেও অর্ডার আপডেট চলবে
  }

  return { ok: true };
}

/** রিটার্ন/বাতিল/রিপ্লেসমেন্ট অনুরোধ (কাস্টমার) */
export function requestReturn(input: {
  orderNumber: string;
  type: ReturnRequest['type'];
  reason: string;
  details?: string;
  proofImage?: string | null;
}): { ok: boolean; error?: string } {
  const order = orderByNumber(input.orderNumber);
  if (!order) return { ok: false, error: 'অর্ডার পাওয়া যায়নি' };
  const user = getCurrentUser();
  if (order.userId && user && order.userId !== user.id) return { ok: false, error: 'এটি আপনার অর্ডার নয়' };
  const req: ReturnRequest = {
    id: uid('rtn'),
    orderNumber: input.orderNumber,
    userId: order.userId ?? null,
    customerName: order.customerName,
    type: input.type,
    reason: input.reason,
    details: input.details || '',
    proofImage: input.proofImage ?? null,
    status: 'PENDING',
    adminNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.append('returnRequests', req);

  const notification: Notification = {
    id: uid('ntf'),
    userId: order.userId ?? null,
    title: input.type === 'cancel' ? 'বাতিলের অনুরোধ জমা হয়েছে' : input.type === 'return' ? 'রিটার্ন অনুরোধ জমা হয়েছে' : 'রিপ্লেসমেন্ট অনুরোধ জমা হয়েছে',
    message: `${input.orderNumber} — আমাদের টিম ২৪-৪৮ ঘণ্টার মধ্যে রিভিউ করবে।`,
    type: 'order',
    read: false,
    link: null,
    createdAt: new Date().toISOString(),
  };
  db.append('notifications', notification);
  return { ok: true };
}

export function returnRequestsList(): ReturnRequest[] {
  return [...db.collection('returnRequests')].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** অ্যাডমিন: রিটার্ন রিভিউ */
export function reviewReturnRequest(id: string, decision: 'APPROVED' | 'REJECTED' | 'REFUNDED', adminNote?: string): { ok: boolean; error?: string } {
  const req = db.findById('returnRequests', id);
  if (!req) return { ok: false, error: 'অনুরোধ পাওয়া যায়নি' };
  const now = new Date().toISOString();
  db.put('returnRequests', { ...req, status: decision, adminNote: adminNote ?? req.adminNote, updatedAt: now });

  const order = orderByNumber(req.orderNumber);
  if (order) {
    if (decision === 'APPROVED' && req.type === 'cancel') {
      updateOrderStatus(order.id, 'CANCELLED', { note: 'কাস্টমারের অনুরোধে বাতিল', by: 'admin' });
    } else if (decision === 'APPROVED' && req.type === 'return') {
      updateOrderStatus(order.id, 'RETURNED', { note: 'রিটার্ন অনুমোদিত', by: 'admin' });
    } else if (decision === 'REFUNDED') {
      updateOrderStatus(order.id, 'REFUNDED', { note: 'রিফান্ড সম্পন্ন', by: 'admin' });
    }
    const notification: Notification = {
      id: uid('ntf'),
      userId: order.userId ?? null,
      title: 'রিটার্ন আপডেট',
      message: `${req.orderNumber} অনুরোধ: ${decision === 'APPROVED' ? 'অনুমোদিত ✅' : decision === 'REJECTED' ? 'বাতিল' : 'রিফান্ড সম্পন্ন'}${adminNote ? ` — ${adminNote}` : ''}`,
      type: 'order',
      read: false,
      link: null,
      createdAt: now,
    };
    db.append('notifications', notification);
  }
  return { ok: true };
}

/** রিঅর্ডার — আগের অর্ডারের সব আইটেম কার্টে */
export function reorder(orderNumber: string): { ok: boolean; error?: string } {
  const order = orderByNumber(orderNumber);
  if (!order) return { ok: false, error: 'অর্ডার পাওয়া যায়নি' };
  for (const item of order.items) {
    const p = productBySlug(item.productSlug);
    if (p) addToCart(p.id, item.quantity, item.variantKey || '');
  }
  return { ok: true };
}

// ═══════════════════════════ পেমেন্ট (অ্যাডমিন) ═══════════════════════════

export function transactionsList(): PaymentTransaction[] {
  return [...db.collection('transactions')].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** ট্রানজেকশন ভেরিফাই → অর্ডার PAID */
export function verifyTransaction(trxId: string, status: 'VERIFIED' | 'FAILED', by = 'admin'): { ok: boolean; error?: string } {
  const trx = db.findById('transactions', trxId);
  if (!trx) return { ok: false, error: 'ট্রানজেকশন পাওয়া যায়নি' };
  const now = new Date().toISOString();
  db.put('transactions', { ...trx, status, verifiedAt: status === 'VERIFIED' ? now : null, verifiedBy: by });

  const order = orderByNumber(trx.orderNumber);
  if (order) {
    const paymentStatus: PaymentStatus = status === 'VERIFIED' ? 'PAID' : 'FAILED';
    db.put('orders', { ...order, paymentStatus, updatedAt: now, transaction: order.transaction ? { ...order.transaction, verifiedAt: status === 'VERIFIED' ? now : null, verifiedBy: by } : order.transaction });
    db.append('notifications', {
      id: uid('ntf'),
      userId: order.userId ?? null,
      title: status === 'VERIFIED' ? 'পেমেন্ট নিশ্চিত হয়েছে' : 'পেমেন্ট ব্যর্থ হয়েছে',
      message: `অর্ডার ${order.orderNumber} — ${status === 'VERIFIED' ? 'আপনার পেমেন্ট গ্রহণ করা হয়েছে' : 'পেমেন্ট যাচাই ব্যর্থ, অনুগ্রহ করে যোগাযোগ করুন'}`,
      type: 'payment',
      read: false,
      link: null,
      createdAt: now,
    });
    db.append('auditLogs', {
      id: uid('aud'), actor: by, actorId: null, action: 'payment.verify',
      entity: 'order', entityId: order.orderNumber,
      details: `trx ${trx.trxId || trx.id} → ${status}`,
      createdAt: now,
    });
  }
  return { ok: true };
}

/** ম্যানুয়াল পেমেন্ট এন্ট্রি (COD কালেকশন/ব্যাংক ট্রান্সফার) */
export function createManualTransaction(input: { orderNumber: string; methodId: string; amount: number; trxId?: string; note?: string }): { ok: boolean; error?: string } {
  const order = orderByNumber(input.orderNumber);
  if (!order) return { ok: false, error: 'অর্ডার পাওয়া যায়নি' };
  const method = db.findById('paymentMethods', input.methodId);
  db.prepend('transactions', {
    id: uid('trx'),
    orderNumber: input.orderNumber,
    methodId: input.methodId,
    methodName: method?.name || 'ম্যানুয়াল',
    amount: input.amount,
    trxId: input.trxId || null,
    senderNumber: null,
    status: 'PENDING',
    verifiedAt: null,
    verifiedBy: null,
    note: input.note || null,
    createdAt: new Date().toISOString(),
  });
  return { ok: true };
}

/** রিফান্ড (full/partial) */
export function refundOrder(orderId: string, amount: number, note?: string, by = 'admin'): { ok: boolean; error?: string } {
  const order = db.findById('orders', orderId);
  if (!order) return { ok: false, error: 'অর্ডার পাওয়া যায়নি' };
  if (amount <= 0 || amount > order.total) return { ok: false, error: 'রিফান্ডের পরিমাণ সঠিক নয়' };
  const now = new Date().toISOString();
  const partial = amount < order.total;
  db.put('orders', {
    ...order,
    paymentStatus: partial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
    status: partial ? order.status : ('REFUNDED' as OrderStatus),
    updatedAt: now,
    transaction: order.transaction
      ? { ...order.transaction, refundedAmount: (order.transaction.refundedAmount || 0) + amount }
      : order.transaction,
  });
  db.append('auditLogs', {
    id: uid('aud'), actor: by, actorId: null, action: 'payment.refund',
    entity: 'order', entityId: order.orderNumber, details: `৳${amount} ${partial ? '(আংশিক)' : '(সম্পূর্ণ)'}${note ? ` — ${note}` : ''}`,
    createdAt: now,
  });
  if (order.userId) {
    db.append('notifications', {
      id: uid('ntf'), userId: order.userId, title: 'রিফান্ড প্রক্রিয়াকরণ',
      message: `অর্ডার ${order.orderNumber} — ৳${amount} রিফান্ড করা হয়েছে।`,
      type: 'payment', read: false, link: null, createdAt: now,
    });
  }
  return { ok: true };
}

// ═══════════════════════════ ইউজার ম্যানেজমেন্ট (অ্যাডমিন) ═══════════════════════════

export function customersList(): (User & { orderCount: number; totalSpent: number; lastOrderAt?: string | null })[] {
  const users = db.collection('users').filter((u) => u.roleId === 'customer');
  const orders = db.collection('orders');
  return users
    .map((u) => {
      const mine = orders.filter((o) => o.userId === u.id);
      return {
        ...u,
        orderCount: mine.length,
        totalSpent: mine.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + o.total, 0),
        lastOrderAt: mine.length ? mine.map((o) => o.createdAt).sort().reverse()[0] : null,
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function staffList(): User[] {
  return db.collection('users').filter((u) => u.roleId !== 'customer');
}

/** স্টাফ তৈরি — Firebase Auth ভিত্তিক (auth.ts-এ সরানো হয়েছে; এখানে রি-এক্সপোর্ট নেই) */

export function updateUserAccess(userId: string, patch: { roleId?: string; status?: 'active' | 'suspended'; customerGroup?: string | null; groupNote?: string | null }): { ok: boolean; error?: string } {
  const actor = getCurrentUser();
  const target = db.findById('users', userId);
  if (!target) return { ok: false, error: 'ইউজার পাওয়া যায়নি' };
  if (patch.roleId && !can(actor, 'roles.manage')) return { ok: false, error: 'রোল পরিবর্তনের অনুমতি নেই' };

  // সুরক্ষা: শেষ সুপার অ্যাডমিনকে ডাউনগ্রেড/সাসপেন্ড করা যাবে না
  const superAdmins = db.collection('users').filter((u) => u.roleId === 'super_admin' && u.status === 'active');
  if (
    target.roleId === 'super_admin' &&
    ((patch.roleId && patch.roleId !== 'super_admin') || patch.status === 'suspended') &&
    superAdmins.length <= 1
  ) {
    return { ok: false, error: 'শেষ সুপার অ্যাডমিনকে পরিবর্তন করা যাবে না' };
  }

  db.put('users', { ...target, ...patch });
  db.append('auditLogs', {
    id: uid('aud'), actor: actor?.email || 'admin', actorId: actor?.id ?? null,
    action: 'user.update', entity: 'user', entityId: target.email || target.phone || target.id,
    details: JSON.stringify(patch), createdAt: new Date().toISOString(),
  });
  return { ok: true };
}

export function rolesList(): Role[] {
  return db.collection('roles');
}

export function saveRole(input: Omit<Role, 'createdAt'> & { createdAt?: string }): { ok: boolean; error?: string } {
  const actor = getCurrentUser();
  if (!can(actor, 'roles.manage')) return { ok: false, error: 'অনুমতি নেই' };
  const existing = db.findById('roles', input.id);
  const existingPerms = Array.isArray(existing?.permissions) ? existing!.permissions.length : 0;
  if (existing?.isSystem && input.permissions.length < existingPerms && input.id === 'super_admin') {
    return { ok: false, error: 'সুপার অ্যাডমিনের পারমিশন কমানো যাবে না' };
  }
  const role: Role = { ...input, createdAt: existing?.createdAt || new Date().toISOString() };
  db.put('roles', role);
  db.append('auditLogs', {
    id: uid('aud'), actor: actor?.email || 'admin', actorId: actor?.id ?? null,
    action: existing ? 'role.update' : 'role.create', entity: 'role', entityId: role.name,
    details: `${role.permissions.length} permissions`, createdAt: new Date().toISOString(),
  });
  return { ok: true };
}

export function deleteRole(id: string): { ok: boolean; error?: string } {
  const role = db.findById('roles', id);
  if (!role) return { ok: false, error: 'রোল পাওয়া যায়নি' };
  if (role.isSystem) return { ok: false, error: 'সিস্টেম রোল ডিলিট করা যাবে না' };
  if (db.collection('users').some((u) => u.roleId === id)) return { ok: false, error: 'এই রোলে ইউজার আছে' };
  db.remove('roles', id);
  return { ok: true };
}

// ═══════════════════════════ নোটিফিকেশন ═══════════════════════════

export function notificationsFor(userId: string | null): Notification[] {
  const all = db.collection('notifications');
  // RTDB null ড্রপ করে — broadcast (userId: null) রাউন্ড-ট্রিপে undefined হয়, তাই loose check
  const mine = all.filter((n) => n.userId === userId || n.userId == null);
  return mine.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function unreadNotificationCount(userId: string | null): number {
  return notificationsFor(userId).filter((n) => !n.read).length;
}

export function markNotificationsRead(ids?: string[]): void {
  const user = getCurrentUser();
  const all = db.collection('notifications');
  db.setCollection(
    'notifications',
    all.map((n) => (!ids || ids.includes(n.id)) && (n.userId === (user?.id ?? null) || n.userId == null) ? { ...n, read: true } : n)
  );
}

export function sendBroadcastNotification(input: { title: string; message: string; type: Notification['type'] }): void {
  db.prepend('notifications', {
    id: uid('ntf'), userId: null, title: input.title, message: input.message,
    type: input.type, read: false, link: null, createdAt: new Date().toISOString(),
  });
}

/** অ্যাডমিন — ব্রডকাস্ট নোটিফিকেশন এডিট (শিরোনাম/বার্তা/ধরন) */
export function updateNotification(
  id: string,
  patch: { title?: string; message?: string; type?: Notification['type'] },
): { ok: boolean; error?: string } {
  const n = db.findById('notifications', id);
  if (!n) return { ok: false, error: 'নোটিফিকেশন পাওয়া যায়নি' };
  db.put('notifications', {
    ...n,
    title: typeof patch.title === 'string' ? patch.title.trim() : n.title,
    message: typeof patch.message === 'string' ? patch.message.trim() : n.message,
    type: patch.type ?? n.type,
  });
  return { ok: true };
}

/** অ্যাডমিন — নোটিফিকেশন ডিলিট (ব্রডকাস্ট + ব্যক্তিগত দুটোই) */
export function deleteNotification(id: string): { ok: boolean; error?: string } {
  const n = db.findById('notifications', id);
  if (!n) return { ok: false, error: 'নোটিফিকেশন পাওয়া যায়নি' };
  db.remove('notifications', id);
  return { ok: true };
}

/**
 * অ্যাডমিন — পুরোনো ব্রডকাস্ট আবার পাঠানো (রিসেন্ড)।
 * নতুন createdAt সহ কপি তৈরি হয় — তাই সব ওপেন ট্যাবে টোস্ট পপআপ আবার ট্রিগার হয়।
 */
export function resendBroadcastNotification(id: string): { ok: boolean; error?: string } {
  const n = db.findById('notifications', id);
  if (!n) return { ok: false, error: 'নোটিফিকেশন পাওয়া যায়নি' };
  db.prepend('notifications', {
    id: uid('ntf'), userId: null, title: n.title, message: n.message,
    type: n.type, read: false, link: n.link ?? null, createdAt: new Date().toISOString(),
  });
  return { ok: true };
}

/** অ্যাডমিন — সব ব্রডকাস্ট একসাথে মুছে ফেলা (রিটার্ন: মুছে ফেলা সংখ্যা) */
export function clearAllBroadcasts(): number {
  const broadcasts = db.collection('notifications').filter((n) => n.userId == null);
  if (broadcasts.length === 0) return 0;
  db.setCollection(
    'notifications',
    db.collection('notifications').filter((n) => n.userId != null),
  );
  return broadcasts.length;
}

// ═══════════════════════════ সাপোর্ট টিকেট ═══════════════════════════

export function createTicket(input: { name: string; email?: string; phone?: string; subject: string; orderNumber?: string; message: string; userId?: string | null }): SupportTicket {
  const ticket: SupportTicket = {
    id: uid('tkt'),
    ticketNumber: `TKT-${Date.now().toString().slice(-6)}`,
    userId: input.userId ?? getCurrentUser()?.id ?? null,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    subject: input.subject,
    orderNumber: input.orderNumber || null,
    status: 'OPEN',
    messages: [{ from: 'customer', text: input.message, at: new Date().toISOString() }],
    rating: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.append('tickets', ticket);
  return ticket;
}

export function ticketsOfUser(userId: string | null): SupportTicket[] {
  return db.collection('tickets').filter((t) => t.userId === userId || (userId === null && !t.userId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function allTickets(): SupportTicket[] {
  return [...db.collection('tickets')].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function replyTicket(ticketId: string, from: 'customer' | 'admin', text: string): { ok: boolean; error?: string } {
  const t = db.findById('tickets', ticketId);
  if (!t) return { ok: false, error: 'টিকেট পাওয়া যায়নি' };
  const now = new Date().toISOString();
  db.put('tickets', {
    ...t,
    status: from === 'admin' ? 'ANSWERED' : 'OPEN',
    messages: [...(Array.isArray(t.messages) ? t.messages : []), { from, text, at: now }],
    updatedAt: now,
  });
  return { ok: true };
}

export function rateTicket(ticketId: string, rating: number): void {
  const t = db.findById('tickets', ticketId);
  if (t) db.put('tickets', { ...t, rating });
}

export function closeTicket(ticketId: string): void {
  const t = db.findById('tickets', ticketId);
  if (t) db.put('tickets', { ...t, status: 'CLOSED', updatedAt: new Date().toISOString() });
}

// ═══════════════════════════ কনটেন্ট / CMS ═══════════════════════════

export function slidesList(): Slide[] {
  return db.collection('slides').filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function sideBannersList(): SideBanner[] {
  return db.collection('sideBanners').filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function whyUsList(): WhyUsItem[] {
  return db.collection('whyUs').filter((w) => w.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** পণ্য পেজ পার্ক বক্স — সক্রিয় আইটেম, ক্রম অনুযায়ী */
export function productPerksList(): ProductPerk[] {
  return db.collection('productPerks').filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function testimonialsList(): Testimonial[] {
  return db.collection('testimonials').filter((t) => t.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function pageBySlug(slug: string): CmsPage | undefined {
  return db.collection('pages').find((p) => p.slug === slug && p.published);
}

export function pagesList(): CmsPage[] {
  return db.collection('pages');
}

export function settingsMap(): SiteSettings {
  return db.get().settings;
}

export function flashSaleInfo() {
  return db.get().flashSale;
}

// ═══════════════════════════ স্লাইডিং ঘোষণা (অ্যাডমিন CRUD) ═══════════════════════════

/** স্লাইডিং ঘোষণার তালিকা (ক্রম অনুযায়ী) */
export function announcementItems(): Announcement[] {
  return [...db.collection('announcements')].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** নতুন/বিদ্যমান ঘোষণা সেভ */
export function saveAnnouncementItem(item: Announcement): void {
  const actor = getCurrentUser();
  db.put('announcements', item);
  logAudit({
    actor: actor?.email || 'admin', action: 'announcement.save',
    entity: 'announcement', entityId: item.id, details: item.text.slice(0, 80),
  });
}

/** ঘোষণা মুছে ফেলা */
export function deleteAnnouncementItem(id: string, text = ''): void {
  const actor = getCurrentUser();
  db.remove('announcements', id);
  logAudit({
    actor: actor?.email || 'admin', action: 'announcement.delete',
    entity: 'announcement', entityId: id, details: text.slice(0, 80),
  });
}

/** ঘোষণার ক্রম উপরে/নিচে সরানো */
export function moveAnnouncementItem(id: string, dir: -1 | 1): void {
  const items = announcementItems();
  const idx = items.findIndex((x) => x.id === id);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= items.length) return;
  [items[idx], items[swap]] = [items[swap], items[idx]];
  db.setCollection('announcements', items.map((it, i) => ({ ...it, sortOrder: i + 1 })));
}

// ═══════════════════════════ ইনভেন্টরি (অ্যাডমিন) ═══════════════════════════

export function adjustStock(productId: string, delta: number, note?: string): void {
  const p = db.findById('products', productId);
  if (!p) return;
  const now = new Date().toISOString();
  db.put('products', { ...p, stock: Math.max(0, p.stock + delta) });
  db.prepend('stockMovements', {
    id: uid('stk'), productId, productName: p.nameBn || p.name,
    type: delta >= 0 ? 'in' : 'out', quantity: Math.abs(delta),
    note: note || (delta >= 0 ? 'স্টক ইন' : 'স্টক আউট'), ref: null, createdAt: now,
  });
}

export function stockMovementsList(): StockMovement[] {
  return [...db.collection('stockMovements')].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ═══════════════════════════ খরচ (Expense) ═══════════════════════════

export function expensesList(): Expense[] {
  return [...db.collection('expenses')].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function addExpense(input: Omit<Expense, 'id' | 'createdAt'>): Expense {
  const e: Expense = { ...input, id: uid('exp'), createdAt: new Date().toISOString() };
  db.append('expenses', e);
  return e;
}

export function deleteExpense(id: string): void {
  db.remove('expenses', id);
}

// ═══════════════════════════ অডিট লগ ═══════════════════════════

export function auditLogsList(): AuditLog[] {
  return [...db.collection('auditLogs')].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function logAudit(input: { actor: string; action: string; entity: string; entityId?: string; details?: string }): void {
  db.prepend('auditLogs', {
    id: uid('aud'), actor: input.actor, actorId: getCurrentUser()?.id ?? null,
    action: input.action, entity: input.entity, entityId: input.entityId ?? null,
    details: input.details ?? null, createdAt: new Date().toISOString(),
  });
}

// ═══════════════════════════ সাবস্ক্রাইবার ও মিডিয়া ═══════════════════════════

export function subscribeEmail(email: string): { ok: boolean; error?: string } {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'সঠিক ইমেইল দিন' };
  if (db.collection('subscribers').some((s) => s.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: 'এই ইমেইল আগেই সাবস্ক্রাইব করা হয়েছে' };
  }
  db.prepend('subscribers', { id: uid('sub'), email, createdAt: new Date().toISOString() } satisfies Subscriber);
  return { ok: true };
}

export function subscribersList(): Subscriber[] {
  return db.collection('subscribers');
}

export function mediaList(): MediaItem[] {
  return db.collection('media');
}

export function addMedia(name: string, dataUrl: string): MediaItem {
  const item: MediaItem = { id: uid('media'), name, dataUrl, size: Math.round(dataUrl.length * 0.75), createdAt: new Date().toISOString() };
  db.append('media', item);
  return item;
}

export function deleteMedia(id: string): void {
  db.remove('media', id);
}

// ═══════════════════════════ রিপোর্ট ও অ্যানালিটিক্স ═══════════════════════════

export type DashboardStats = {
  totalRevenue: number;        // PAID/DELIVERED ভিত্তিক প্রকৃত আয়
  potentialRevenue: number;    // সব নন-ক্যান্সেল অর্ডারের মূল্য
  totalOrders: number;
  todaySales: number;
  todayOrders: number;
  weeklySales: number;
  monthlySales: number;
  yearlySales: number;
  totalCustomers: number;
  newCustomers: number;
  totalProducts: number;
  activeProducts: number;
  lowStock: number;
  outOfStock: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingPayments: number;
  refundRequests: number;
  returnRequests: number;
  pendingReviews: number;
  openTickets: number;
  totalExpenses: number;
  grossProfit: number;
  topProducts: { name: string; soldCount: number; revenue: number }[];
  categoryPerformance: { name: string; orders: number; revenue: number }[];
  paymentBreakdown: { method: string; count: number; amount: number }[];
  salesByDay: { day: string; sales: number; orders: number }[];
  recentOrders: Order[];
};

export function dashboardStats(): DashboardStats {
  const orders = db.collection('orders');
  const products = db.collection('products');
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 6 * 86400000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

  const valid = orders.filter((o) => o.status !== 'CANCELLED');
  const paid = valid.filter((o) => o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIALLY_REFUNDED' || (o.paymentType === 'cod' && o.status === 'DELIVERED'));
  const totalRevenue = paid.reduce((s, o) => s + o.total, 0);
  const potentialRevenue = valid.reduce((s, o) => s + o.total, 0);

  const inRange = (o: Order, from: number) => new Date(o.createdAt || '').getTime() >= from;
  const sum = (list: Order[]) => list.reduce((s, o) => s + o.total, 0);

  const expenses = db.collection('expenses');
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // লাভ = আয় - পণ্যের ক্রয়মূল্য(কস্ট না থাকলে ৭০% ধরা) - খরচ
  const costEstimate = paid.reduce(
    (s, o) => s + (o.items || []).reduce((x, i) => x + (i.costPrice ? i.costPrice * i.quantity : i.unitPrice * 0.7 * i.quantity), 0),
    0
  );
  const grossProfit = Math.round(totalRevenue - costEstimate - totalExpenses);

  const dayKey = (iso: string) => (iso || '').slice(0, 10);
  const salesByDay: { day: string; sales: number; orders: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startOfToday - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const dayOrders = valid.filter((o) => dayKey(o.createdAt) === key);
    salesByDay.push({ day: key, sales: sum(dayOrders), orders: dayOrders.length });
  }

  const topProducts = [...products]
    .sort((a, b) => b.soldCount - a.soldCount)
    .slice(0, 8)
    .map((p) => ({ name: p.nameBn || p.name, soldCount: p.soldCount, revenue: p.soldCount * p.price }));

  const catPerf = new Map<string, { orders: number; revenue: number }>();
  for (const o of valid) {
    for (const item of o.items || []) {
      const p = productBySlug(item.productSlug);
      const cat = p ? db.findById('categories', p.categoryId) : null;
      const key = cat?.nameBn || cat?.name || 'অন্যান্য';
      const prev = catPerf.get(key) || { orders: 0, revenue: 0 };
      catPerf.set(key, { orders: prev.orders + item.quantity, revenue: prev.revenue + item.price * item.quantity });
    }
  }
  const categoryPerformance = Array.from(catPerf.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const payMap = new Map<string, { count: number; amount: number }>();
  for (const o of valid) {
    const prev = payMap.get(o.paymentMethodName) || { count: 0, amount: 0 };
    payMap.set(o.paymentMethodName, { count: prev.count + 1, amount: prev.amount + o.total });
  }
  const paymentBreakdown = Array.from(payMap.entries()).map(([method, v]) => ({ method, ...v }));

  const customers = db.collection('users').filter((u) => u.roleId === 'customer');

  return {
    totalRevenue,
    potentialRevenue,
    totalOrders: orders.length,
    todaySales: sum(valid.filter((o) => inRange(o, startOfToday))),
    todayOrders: valid.filter((o) => inRange(o, startOfToday)).length,
    weeklySales: sum(valid.filter((o) => inRange(o, weekAgo))),
    monthlySales: sum(valid.filter((o) => inRange(o, monthStart))),
    yearlySales: sum(valid.filter((o) => inRange(o, yearStart))),
    totalCustomers: customers.length,
    newCustomers: customers.filter((u) => new Date(u.createdAt).getTime() >= weekAgo).length,
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.active).length,
    lowStock: products.filter((p) => p.stock > 0 && p.stock <= 10).length,
    outOfStock: products.filter((p) => p.stock === 0).length,
    pendingOrders: orders.filter((o) => o.status === 'PENDING').length,
    processingOrders: orders.filter((o) => ['CONFIRMED', 'PROCESSING', 'PACKED'].includes(o.status)).length,
    shippedOrders: orders.filter((o) => ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.status)).length,
    deliveredOrders: orders.filter((o) => o.status === 'DELIVERED').length,
    cancelledOrders: orders.filter((o) => o.status === 'CANCELLED').length,
    pendingPayments: orders.filter((o) => o.paymentStatus === 'PENDING' && o.paymentType !== 'cod').length,
    refundRequests: db.collection('returnRequests').filter((r) => r.status === 'PENDING' || r.status === 'APPROVED').length,
    returnRequests: db.collection('returnRequests').filter((r) => r.status === 'PENDING').length,
    pendingReviews: db.collection('reviews').filter((r) => r.status === 'PENDING').length,
    openTickets: db.collection('tickets').filter((t) => t.status !== 'CLOSED').length,
    totalExpenses,
    grossProfit,
    topProducts,
    categoryPerformance,
    paymentBreakdown,
    salesByDay,
    recentOrders: [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 8),
  };
}

/** রিপোর্ট ডেটা → CSV */
export function toCSV(rows: Record<string, unknown>[], headers?: Record<string, string>): string {
  if (!rows.length) return '';
  const keys = headers ? Object.keys(headers) : Object.keys(rows[0]);
  const head = headers ? Object.values(headers) : keys;
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[], headers?: Record<string, string>): void {
  const csv = '\uFEFF' + toCSV(rows, headers); // BOM যাতে এক্সেলে বাংলা ঠিক দেখায়
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════ প্রোডাক্ট সেভ (অ্যাডমিন) ═══════════════════════════

export type ProductInput = Partial<Product> & { name: string; price: number; categoryId: string };

export function saveProduct(input: ProductInput): { ok: boolean; error?: string; product?: Product } {
  const actor = getCurrentUser();
  if (!isAdminUser(actor)) return { ok: false, error: 'অনুমতি নেই' };
  const existing = input.id ? db.findById('products', input.id) : undefined;
  const slug = input.slug || (input.name || 'product').toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  const product: Product = {
    id: existing?.id || uid('prd'),
    name: input.name,
    nameBn: input.nameBn ?? input.name,
    slug: existing?.slug || slug,
    sku: input.sku || `TS-${Date.now().toString(36).toUpperCase()}`,
    description: input.description ?? '',
    shortDescription: input.shortDescription ?? '',
    price: Number(input.price) || 0,
    comparePrice: input.comparePrice ? Number(input.comparePrice) : null,
    unit: input.unit || 'পিস',
    stock: Number(input.stock) || 0,
    images: typeof input.images === 'string' ? input.images : JSON.stringify(input.images || []),
    colors: typeof input.colors === 'string' ? input.colors : input.colors ? JSON.stringify(input.colors) : null,
    sizes: typeof input.sizes === 'string' ? input.sizes : input.sizes ? JSON.stringify(input.sizes) : null,
    categoryId: input.categoryId,
    brandId: input.brandId || null,
    isFeatured: !!input.isFeatured,
    isNew: !!input.isNew,
    isBestSeller: !!input.isBestSeller,
    isPreOrder: !!input.isPreOrder,
    active: input.active ?? true,
    rating: existing?.rating ?? 0,
    reviewCount: existing?.reviewCount ?? 0,
    soldCount: existing?.soldCount ?? 0,
    weight: input.weight ?? null,
    origin: input.origin ?? null,
    variants: input.variants ?? [],
  };
  if (existing) {
    db.put('products', product);
    logAudit({ actor: actor?.email || 'admin', action: 'product.update', entity: 'product', entityId: product.slug, details: product.nameBn || product.name });
  } else {
    db.prepend('products', product);
    logAudit({ actor: actor?.email || 'admin', action: 'product.create', entity: 'product', entityId: product.slug, details: product.nameBn || product.name });
  }
  return { ok: true, product };
}

export function deleteProduct(id: string): { ok: boolean; error?: string } {
  const actor = getCurrentUser();
  if (!isAdminUser(actor)) return { ok: false, error: 'অনুমতি নেই' };
  const p = db.findById('products', id);
  if (!p) return { ok: false, error: 'পণ্য পাওয়া যায়নি' };
  db.remove('products', id);
  logAudit({ actor: actor?.email || 'admin', action: 'product.delete', entity: 'product', entityId: p.slug, details: p.nameBn || p.name });
  return { ok: true };
}

// ═══════════════════════════ সেটিংস সেভ (অ্যাডমিন) ═══════════════════════════

export function saveSettings(patch: Partial<SiteSettings>): void {
  const actor = getCurrentUser();
  db.updateSettings(patch);
  logAudit({ actor: actor?.email || 'admin', action: 'settings.update', entity: 'settings', details: Object.keys(patch).join(', ') });
}

export { getCurrentUser, isAdminUser, can };

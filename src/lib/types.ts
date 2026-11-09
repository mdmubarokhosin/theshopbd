export type Category = {
  id: string;
  name: string;
  nameBn?: string | null;
  slug: string;
  icon?: string | null;
  image?: string | null;
  description?: string | null;
  color?: string | null;
  featured: boolean;
  active?: boolean;
  sortOrder: number;
  parentId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  children?: Category[];
};

export type Brand = {
  id: string;
  name: string;
  nameBn?: string | null;
  slug: string;
  logo?: string | null;
  description?: string | null;
  featured?: boolean;
  active?: boolean;
  sortOrder?: number;
  productCount?: number;
};

export type ColorOption = {
  name: string;
  hex?: string;
};

export type ProductVariant = {
  id?: string;
  productId?: string;
  key: string;
  color?: string | null;
  colorHex?: string | null;
  size?: string | null;
  price: number;
  stock: number;
  image?: string | null;
};

export type Product = {
  id: string;
  name: string;
  nameBn?: string | null;
  slug: string;
  sku: string;
  description: string;
  shortDescription?: string | null;
  price: number;
  comparePrice?: number | null;
  unit: string;
  stock: number;
  images: string;
  colors?: string | null;
  sizes?: string | null;
  categoryId: string;
  category?: Category;
  brandId?: string | null;
  brand?: Brand | null;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  isPreOrder: boolean;
  active: boolean;
  rating: number;
  reviewCount: number;
  soldCount: number;
  weight?: string | null;
  origin?: string | null;
  variants?: ProductVariant[];
};

export type Review = {
  id: string;
  productId: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type CartItemData = {
  id: string;
  productId: string;
  variantId?: string | null;
  variantKey?: string;
  variant?: ProductVariant | null;
  quantity: number;
  product: Product;
};

export type OrderItemData = {
  id: string;
  productName: string;
  productSlug: string;
  variantName?: string | null;
  image?: string | null;
  price: number;
  quantity: number;
};

export type OrderData = {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  area?: string | null;
  paymentMethod: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItemData[];
};

export type View =
  | { name: 'home' }
  | { name: 'shop'; category?: string; search?: string; offers?: boolean; brand?: string }
  | { name: 'search'; q?: string }
  | { name: 'product'; slug: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'order-success'; orderNumber: string }
  | { name: 'track-order'; orderNumber?: string }
  | { name: 'wishlist' }
  | { name: 'compare' }
  | { name: 'info'; page: InfoPage }
  | { name: 'auth'; mode?: 'login' | 'register' }
  | { name: 'account'; tab?: AccountTab }
  | { name: 'admin' };

export type AccountTab =
  | 'dashboard'
  | 'orders'
  | 'profile'
  | 'addresses'
  | 'wishlist'
  | 'notifications'
  | 'tickets'
  | 'reviews'
  | 'loyalty'
  | 'referral'
  | 'security';

export type InfoPage =
  | 'about'
  | 'contact'
  | 'faq'
  | 'shipping'
  | 'cancellation'
  | 'terms'
  | 'privacy'
  | 'stories'
  // CMS থেকে যোগ করা যেকোনো কাস্টম পেজ স্লাগ
  | (string & {});

export const FREE_SHIPPING_THRESHOLD = 2000;
export const SHIPPING_COST_DHAKA = 60;
export const SHIPPING_COST_OUTSIDE = 120;

export function formatBDT(amount: number): string {
  return `৳${toBn(Math.round(amount).toLocaleString('en-IN'))}`;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBn(value: number | string): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function formatBnDate(date: string | Date): string {
  try {
    const d = new Date(date);
    // অবৈধ/হারানো তারিখে "Invalid Date" না দেখিয়ে ফাঁকা — RTDB-তে পুরোনো
    // এন্ট্রিতে createdAt মিসিং হতে পারে
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(date);
  }
}

export const ORDER_STATUS_BN: Record<string, string> = {
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

export const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  PROCESSING: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  PACKED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  SHIPPED: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  OUT_FOR_DELIVERY: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  FAILED_DELIVERY: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  RETURNED: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  REFUNDED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
};

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'FAILED_DELIVERY',
  'RETURNED',
  'REFUNDED',
] as const;

/** ট্র্যাকিং টাইমলাইনে দেখানো মূল ধারাগুলো */
export const TRACKING_FLOW: string[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export function discountPercent(price: number, comparePrice?: number | null): number {
  if (!comparePrice || comparePrice <= price) return 0;
  return Math.round(((comparePrice - price) / comparePrice) * 100);
}

export function getProductImages(product: { images: string }): string[] {
  try {
    const arr = JSON.parse(product.images);
    return Array.isArray(arr) ? arr : [product.images];
  } catch {
    return [product.images];
  }
}

/** Parse product.colors JSON → ColorOption[] */
export function parseColors(colors?: string | null): ColorOption[] {
  if (!colors) return [];
  try {
    const arr = JSON.parse(colors);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((c) =>
        typeof c === 'string'
          ? { name: c }
          : { name: String(c?.name || ''), hex: c?.hex ? String(c.hex) : undefined }
      )
      .filter((c) => c.name);
  } catch {
    return [];
  }
}

/** Parse product.sizes JSON → string[] */
export function parseSizes(sizes?: string | null): string[] {
  if (!sizes) return [];
  try {
    const arr = JSON.parse(sizes);
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Build variant key from color + size: "লাল|XL" */
export function buildVariantKey(color?: string | null, size?: string | null): string {
  return [color || '', size || ''].join('|');
}

/** Human-readable variant label: "রং: লাল, সাইজ: XL" */
export function variantLabel(v?: { color?: string | null; size?: string | null } | null): string {
  if (!v) return '';
  const parts: string[] = [];
  if (v.color) parts.push(`রং: ${v.color}`);
  if (v.size) parts.push(`সাইজ: ${v.size}`);
  return parts.join(', ');
}

/** Effective unit price of a cart item (variant price overrides product price) */
export function cartItemPrice(item: CartItemData): number {
  return item.variant ? item.variant.price : item.product.price;
}

/** Cart item display image (variant image overrides product image) */
export function cartItemImage(item: CartItemData): string | null {
  return item.variant?.image || getProductImages(item.product)[0] || null;
}

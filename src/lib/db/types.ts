/**
 * THE SHOP BD — লোকাল ডেটাবেস টাইপ সংজ্ঞা
 * ---------------------------------------------------------------------------
 * সব এন্টিটির টাইপ এখানে। localStorage ডেটা লেয়ার এই টাইপগুলো ব্যবহার করে।
 * ভবিষ্যতে রিয়েল ব্যাকএন্ড যোগ করলে একই টাইপ দিয়ে API Response মডেল করা যাবে
 * (docs/FUTURE-BACKEND.md দেখুন)।
 */
import type {
  Product,
  ProductVariant,
  Category,
  Brand,
  OrderItemData,
} from '@/lib/types';

export type { Product, ProductVariant, Category, Brand, OrderItemData };

// ───────────────────────────── Roles & Permissions ─────────────────────────────

/** সব পারমিশন কী (RBAC) */
export const PERMISSIONS = [
  'dashboard.view',
  'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import', 'products.export',
  'categories.manage', 'brands.manage',
  'orders.view', 'orders.edit', 'orders.cancel', 'orders.refund', 'orders.export',
  'payments.view', 'payments.manage', 'payments.verify', 'payments.refund',
  'customers.view', 'customers.manage', 'customers.export',
  'coupons.manage', 'marketing.manage',
  'delivery.manage', 'couriers.manage',
  'content.manage', 'cms.manage', 'seo.manage',
  'reports.view', 'reports.export', 'expenses.manage',
  'roles.manage', 'staff.manage',
  'settings.manage', 'audit.view', 'backup.manage', 'system.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = {
  id: string;
  name: string;          // ইংরেজি নাম (Super Admin, Order Manager...)
  nameBn: string;        // বাংলা নাম
  permissions: Permission[];
  isSystem: boolean;     // system role ডিলিট করা যাবে না
  createdAt: string;
};

// ───────────────────────────── Users & Auth ─────────────────────────────

export type UserStatus = 'active' | 'suspended';

export type User = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  passwordHash: string;
  salt: string;
  roleId: string;                 // ডিফল্ট 'customer'
  avatar?: string | null;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  dateOfBirth?: string | null;
  customerGroup?: string | null;  // regular | vip | wholesale
  groupNote?: string | null;      // admin note
  newsletterSubscribed: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  refCode?: string | null;        // নিজের রেফারেল কোড (TSB-XXXXXX)
  referredBy?: string | null;     // কার কোড দিয়ে রেজিস্ট্রেশন করেছে (userId)
};

export type Address = {
  id: string;
  userId: string;
  label: string;           // বাসা, অফিস...
  name: string;
  phone: string;
  division?: string | null;      // বিভাগ (geo cascade)
  district: string;
  city: string;
  area: string;
  fullAddress: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: string;
};

// ───────────────────────────── Orders ─────────────────────────────

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'PACKED'
  | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
  | 'CANCELLED' | 'FAILED_DELIVERY' | 'RETURNED' | 'REFUNDED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export type OrderStatusEvent = {
  status: OrderStatus;
  at: string;
  note?: string;
  by?: string;
};

export type OrderItem = OrderItemData & {
  variantKey?: string | null;
  sku?: string | null;
  unitPrice: number;      // ডিস্কাউন্ট-পূর্ব দাম (হিসাবের জন্য)
  costPrice?: number;     // লাভ হিসাবের জন্য (ঐচ্ছিক)
};

export type Order = {
  id: string;
  orderNumber: string;
  userId?: string | null;          // guest হলে null
  customerName: string;
  phone: string;
  email?: string | null;
  address: string;
  division?: string | null;        // বিভাগ (geo cascade)
  district: string;
  city: string;
  area?: string | null;
  zoneId?: string | null;

  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  tax?: number;
  total: number;

  couponCode?: string | null;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentType: string;             // cod | mobile_banking | card | bank
  paymentStatus: PaymentStatus;
  transaction?: {
    trxId?: string | null;
    senderNumber?: string | null;
    verifiedAt?: string | null;
    verifiedBy?: string | null;
    refundedAmount?: number;
  } | null;

  status: OrderStatus;
  statusHistory: OrderStatusEvent[];

  // লয়ালটি ও রেফারেল (v6)
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  loyaltyAwarded?: boolean;        // DELIVERED-এ পয়েন্ট দেওয়া হয়েছে (একবারই)
  referralCredited?: boolean;      // রেফারেল কমিশন দেওয়া হয়েছে (একবারই)

  courierId?: string | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  note?: string | null;            // কাস্টমার নোট
  adminNote?: string | null;       // ইন্টারনাল নোট
  estimatedDelivery?: string | null;

  createdAt: string;
  updatedAt: string;
};

export type ReturnRequest = {
  id: string;
  orderNumber: string;
  userId?: string | null;
  customerName: string;
  type: 'return' | 'cancel' | 'replacement';
  reason: string;
  details?: string;
  proofImage?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

// ───────────────────────────── Payments ─────────────────────────────

export type PaymentMethodType = 'cod' | 'mobile_banking' | 'card' | 'bank_transfer';

export type PaymentMethod = {
  id: string;
  name: string;
  type: PaymentMethodType;
  logo?: string | null;           // /payments/bkash.svg বা data URL
  accountNumber?: string | null;
  instructions?: string | null;
  needsTrxId: boolean;            // চেকআউটে Transaction ID ফিল্ড দেখাবে কি না
  active: boolean;
  sortOrder: number;
};

export type PaymentTransaction = {
  id: string;
  orderNumber: string;
  methodId: string;
  methodName: string;
  amount: number;
  trxId?: string | null;
  senderNumber?: string | null;
  status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'REFUNDED';
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  note?: string | null;
  createdAt: string;
};

// ───────────────────────────── Delivery ─────────────────────────────

export type DeliveryZone = {
  id: string;
  name: string;                    // ঢাকা সিটি
  districts: string[];             // জেলার তালিকা
  charge: number;
  eta: string;                     // ২৪-৭২ ঘণ্টা
  freeShippingOver?: number | null;
  codAvailable: boolean;
  active: boolean;
  sortOrder: number;
};

export type Courier = {
  id: string;
  name: string;
  nameBn: string;
  trackingUrl?: string | null;     // https://steadfast.com.bd/t/{tracking}
  apiKey?: string | null;          // ভবিষ্যৎ API ইন্টিগ্রেশনের জন্য (সংরক্ষিত)
  apiSecret?: string | null;
  active: boolean;
  sortOrder: number;
};

// ───────────────────────────── Marketing ─────────────────────────────

export type BannerAction = {
  name: 'shop' | 'offers' | 'product' | 'page' | 'url';
  category?: string;
  brand?: string;
  slug?: string;    // product slug
  page?: string;    // info page key
  url?: string;
};

export type Slide = {
  id: string;
  theme: number;                 // 0..3 (CSS theme class)
  store: string;
  title: string;
  tagline: string;
  priceFrom?: number | null;
  discount?: string | null;
  cta: string;
  photos: string[];
  action: BannerAction;
  active: boolean;
  sortOrder: number;
};

export type SideBanner = {
  id: string;
  theme: number;
  title: string;
  tagline: string;
  subtitle?: string | null;
  photo?: string | null;
  action: BannerAction;
  active: boolean;
  sortOrder: number;
};

export type WhyUsItem = {
  id: string;
  icon: string;                  // bootstrap icon class (bi-truck)
  title: string;
  text: string;
  active: boolean;
  sortOrder: number;
};

export type Testimonial = {
  id: string;
  name: string;
  role?: string | null;
  text: string;
  rating: number;
  avatar?: string | null;
  active: boolean;
  sortOrder: number;
};

/** স্লাইডিং ঘোষণার একটি আইটেম (হেডারের উপরের মার্কি বারে ঘোরে) */
export type Announcement = {
  id: string;
  icon: string;                  // bootstrap icon class (bi-truck)
  text: string;
  link?: string | null;          // ঐচ্ছিক — ক্লিক করলে যাবে
  enabled: boolean;              // বন্ধ করলে এই লেখাটি আর স্লাইড করবে না
  sortOrder: number;
};

export type FlashSale = {
  enabled: boolean;
  title: string;
  endsAt: string | null;         // ISO datetime
  productIds: string[];
};

export type CouponType = 'percent' | 'fixed' | 'free_shipping';

export type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;                  // percent হলে %, fixed হলে টাকা
  minOrder: number;
  maxDiscount?: number | null;
  startAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;     // মোট ব্যবহার সীমা
  usedCount: number;
  perUserLimit?: number | null;
  categoryIds?: string[] | null;
  productIds?: string[] | null;
  brandIds?: string[] | null;
  firstOrderOnly: boolean;
  active: boolean;
  createdAt: string;
};

// ───────────────────────────── Content / CMS ─────────────────────────────

export type CmsPage = {
  id: string;
  slug: string;                   // about | contact | faq | shipping | ...
  title: string;
  content: string;                // মার্কডাউন-সদৃশ সাধারণ টেক্সট (লাইন ব্রেক সাপোর্টেড)
  published: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  updatedAt: string;
};

export type FooterLinkGroup = {
  id: string;
  title: string;
  links: { label: string; view: string; param?: string }[];
  sortOrder: number;
};

// ───────────────────────────── Reviews & Support ─────────────────────────────

export type Review = {
  id: string;
  productId: string;
  userId?: string | null;
  name: string;
  rating: number;
  comment: string;
  image?: string | null;
  images?: string[];               // রিভিউতে ছবি (০–৩টি, রিভিউ ছবি ফিচার)
  verifiedPurchase: boolean;
  helpfulCount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminReply?: string | null;
  createdAt: string;
};

export type TicketMessage = {
  from: 'customer' | 'admin';
  text: string;
  at: string;
};

export type SupportTicket = {
  id: string;
  ticketNumber: string;
  userId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  subject: string;
  orderNumber?: string | null;
  status: 'OPEN' | 'ANSWERED' | 'CLOSED';
  messages: TicketMessage[];
  rating?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Notification = {
  id: string;
  userId: string | null;          // null = সবার জন্য (broadcast)
  title: string;
  message: string;
  type: 'order' | 'payment' | 'shipment' | 'promo' | 'system' | 'stock';
  read: boolean;
  link?: string | null;
  createdAt: string;
};

// ───────────────────────────── Inventory & Finance ─────────────────────────────

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjust';
  quantity: number;               // adjust হলে +/- ডেল্টা
  note?: string | null;
  ref?: string | null;            // order number
  createdAt: string;
};

export type Expense = {
  id: string;
  category: string;               // delivery | packaging | marketing | gateway_fee | salary | other
  amount: number;
  note?: string | null;
  date: string;                   // YYYY-MM-DD
  createdAt: string;
};

export type Subscriber = {
  id: string;
  email: string;
  createdAt: string;
};

export type MediaItem = {
  id: string;
  name: string;
  dataUrl: string;
  size: number;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actor: string;                  // user name/email
  actorId?: string | null;
  action: string;                 // order.status_change, product.create...
  entity: string;                 // order | product | settings...
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
};

// ───────────────────────────── গ্রোথ — লয়ালটি, রেফারেল, অ্যাব্যান্ডন্ড কার্ট ─────────────────────────────

/** লয়ালটি পয়েন্ট লেজার এন্ট্রি (earn = অর্জন, redeem = খরচ, adjust = অ্যাডমিন সমন্বয়) */
export type LoyaltyEntry = {
  id: string;
  userId: string;
  userName?: string | null;
  type: 'earn' | 'redeem' | 'adjust';
  points: number;                 // earn/adjust ধনাত্মক, redeem ঋণাত্মক
  reason: string;
  orderNumber?: string | null;
  createdAt: string;
};

/** রেফারেল কমিশন ইভেন্ট */
export type ReferralEvent = {
  id: string;
  referrerUserId: string;         // যে রেফার করেছে
  referrerName?: string | null;
  referredUserId?: string | null; // যে কিনেছে
  referredName?: string | null;
  orderNumber: string;
  orderTotal: number;
  commission: number;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  note?: string | null;
  createdAt: string;
};

/** রেফারেল কমিশন তোলার আবেদন */
export type ReferralWithdraw = {
  id: string;
  userId: string;
  userName?: string | null;
  amount: number;
  method: string;                 // বিকাশ / নগদ / ব্যাংক
  account: string;                // নম্বর/অ্যাকাউন্ট
  status: 'PENDING' | 'PAID' | 'REJECTED';
  note?: string | null;
  createdAt: string;
  processedAt?: string | null;
};

/** অ্যাব্যান্ডন্ড কার্ট (কার্টে ফেলে চলে যাওয়া ক্রেতা) */
export type AbandonedCart = {
  id: string;                     // ac_<cartKey>
  userId?: string | null;
  name: string;
  phone?: string | null;
  items: { name: string; qty: number; price: number; image?: string | null }[];
  subtotal: number;
  status: 'open' | 'reminded' | 'recovered' | 'dismissed';
  updatedAt: string;
  lastRemindedAt?: string | null;
  remindedCount: number;
};

/** SMS পাঠানোর লগ */
export type SmsLog = {
  id: string;
  to: string;
  message: string;
  template?: string | null;
  orderNumber?: string | null;
  status: 'sent' | 'failed' | 'skipped';
  provider: string;
  error?: string | null;
  createdAt: string;
};

/** FCM পুশ নোটিফিকেশন টোকেন (ডিভাইস) */
export type PushToken = {
  id: string;
  token: string;
  userId?: string | null;
  platform: string;               // browser | pwa
  createdAt: string;
};

/** কাস্টম পেমেন্ট গেটওয়ে (অ্যাডমিন-সংজ্ঞায়িত — checkout-এ paymentMethods-এর সাথে মিশে যায়) */
export type CustomGateway = {
  id: string;
  name: string;
  logo?: string | null;
  accountNumber?: string | null;
  instructions?: string | null;
  needsTrxId: boolean;
  active: boolean;
  sortOrder: number;
};

// ───────────────────────────── অ্যাকাউন্ট ডিলিট রিকোয়েস্ট ─────────────────────────────

/** ইউজারের অ্যাকাউন্ট ডিলিটের অনুরোধ (স্ট্যাটাস ফ্লো: PENDING → PROCESSING → COMPLETED/REJECTED) */
export type DeletionRequestStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';

export type DeletionRequest = {
  id: string;
  userId: string;
  userName: string;
  email?: string | null;
  phone?: string | null;
  reason?: string | null;          // প্রি-সেট কারণ (ড্রপডাউন)
  details?: string | null;         // ইউজারের লেখা বিস্তারিত
  status: DeletionRequestStatus;
  adminNote?: string | null;       // অ্যাডমিনের ভেতরের নোট / ইউজারকে দেখানো রিপ্লাই
  dataPurged: boolean;             // COMPLETED করার সময় ইউজার ডেটা মুছে ফেলা হয়েছে কি না
  processedAt?: string | null;
  processedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

// ───────────────────────────── Settings ─────────────────────────────

export type SiteSettings = {
  // আইডেন্টিটি
  site_title: string;
  site_tagline: string;
  site_logo: string;              // data URL বা path, খালি = বিল্ট-ইন SVG
  site_favicon: string;
  site_description: string;

  // যোগাযোগ
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  support_hours: string;

  // সোশ্যাল
  social_facebook: string;
  social_youtube: string;
  social_instagram: string;
  social_whatsapp: string;
  social_messenger: string;

  // ফুটার
  footer_text: string;
  footer_about: string;
  footer_cod_text: string;

  // হোমপেজ সেকশন দৃশ্যমানতা
  section_brands: string;
  section_why: string;
  section_testimonials: string;
  section_payment: string;
  section_categories: string;
  section_recently_viewed: string;

  // ঘোষণা বার (স্লাইডিং লেখাগুলোর মাস্টার সুইচ — আইটেমগুলো announcements কালেকশনে)
  announcement_enabled: string;

  // পপআপ নোটিশ (টেক্সট/ইমেজ দুই ফর্মই)
  popup_notice_enabled: string;
  popup_notice_type: string;      // text | image
  popup_notice_title: string;
  popup_notice_message: string;
  popup_notice_image: string;
  popup_notice_button_text: string;
  popup_notice_link: string;

  // পপআপ অফার (টেক্সট/ইমেজ দুই ফর্মই)
  popup_offer_enabled: string;
  popup_offer_type: string;
  popup_offer_title: string;
  popup_offer_message: string;
  popup_offer_image: string;
  popup_offer_button_text: string;
  popup_offer_link: string;

  // লোকালাইজেশন
  default_language: string;       // bn
  currency_code: string;          // BDT
  currency_symbol: string;        // ৳
  timezone: string;               // Asia/Dhaka
  date_format: string;

  // ট্যাক্স ও প্রাইসিং
  tax_enabled: string;
  tax_percent: string;
  tax_inclusive: string;          // দামে ট্যাক্স অন্তর্ভুক্ত কি না
  min_order_amount: string;
  free_shipping_threshold: string;

  // ইনভয়েস
  invoice_note: string;

  // নোটিফিকেশন সেটিংস (ভবিষ্যৎ SMTP/SMS ইন্টিগ্রেশনের ভিত্তি)
  notif_order_enabled: string;
  notif_promo_enabled: string;
  notif_stock_enabled: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_sender_email: string;

  // SEO
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  seo_og_image: string;
  seo_google_verification: string;
  seo_analytics_id: string;

  // নিরাপত্তা
  security_session_timeout: string;   // মিনিট
  security_max_login_attempts: string;
  security_maintenance_mode: string;
  security_maintenance_message: string;

  // সিস্টেম
  system_version: string;

  // GitHub হোস্টিং (মিডিয়া আপলোড: GitHub Contents API → jsDelivr CDN)
  github_owner: string;       // GitHub ইউজারনেম বা অর্গানাইজেশন
  github_repo: string;        // রিপোজিটরি নাম
  github_branch: string;      // ডিফল্ট: main
  github_folder: string;      // আপলোড ফোল্ডার, ডিফল্ট: uploads
  github_token: string;       // Fine-grained PAT (Contents: Read & Write)

  // ── WhatsApp অর্ডার বাটন ও ফ্লোটিং চ্যাট ──
  wa_enabled: string;             // মাস্টার সুইচ
  wa_phone: string;               // 8801XXXXXXXXX (country code সহ)
  wa_message_template: string;    // {site} {product} {price} {url} ভেরিয়েবল
  wa_float_enabled: string;
  wa_float_position: string;      // left | right
  wa_product_button: string;      // পণ্য পেজে "WhatsApp-এ অর্ডার" বাটন

  // ── অ্যানালিটিক্স (GA4 + Facebook Pixel) ──
  ga4_enabled: string;
  ga4_id: string;                 // G-XXXXXXX (খালি হলে Firebase measurementId)
  fb_pixel_enabled: string;
  fb_pixel_id: string;

  // ── পুশ নোটিফিকেশন (FCM) ──
  push_enabled: string;
  push_vapid_key: string;         // Web Push certificate — Firebase Console → Cloud Messaging

  // ── SMS (Bulk SMS BD / SSL Wireless / কাস্টম) ──
  sms_enabled: string;
  sms_provider_type: string;      // bulksmsbd | sslwireless | custom
  sms_api_url: string;
  sms_api_key: string;
  sms_sender_id: string;
  sms_store_id: string;           // SSL Wireless
  sms_store_password: string;     // SSL Wireless
  sms_custom_method: string;      // GET | POST
  sms_custom_body: string;        // কাস্টম প্রোভাইডারের body টেমপ্লেট ({apikey} {to} {message} {sender})
  sms_tpl_order: string;
  sms_tpl_status: string;
  sms_tpl_abandoned: string;
  sms_admin_phone: string;        // নতুন অর্ডারে অ্যাডমিনকে SMS

  // ── Steadfast কুরিয়ার ──
  sf_enabled: string;
  sf_api_url: string;
  sf_api_key: string;
  sf_secret_key: string;
  sf_send_cod: string;            // '1' = অপরিশোধিত অর্ডারে COD amount পাঠাও

  // ── bKash Tokenized Checkout ──
  bkash_enabled: string;
  bkash_mode: string;             // sandbox | live
  bkash_username: string;
  bkash_password: string;
  bkash_app_key: string;
  bkash_app_secret: string;

  // ── SSLCommerz ──
  sslcz_enabled: string;
  sslcz_mode: string;             // sandbox | live
  sslcz_store_id: string;
  sslcz_store_passwd: string;
  sslcz_currency: string;

  // ── ওয়েবহুক সিক্রেট (server → client ইভেন্ট) ──
  webhook_secret: string;

  // ── লয়ালটি পয়েন্ট ──
  loyalty_enabled: string;
  loyalty_earn_rate: string;      // প্রতি ১০০৳-এ কত পয়েন্ট
  loyalty_point_value: string;    // ১ পয়েন্টের মান (৳)
  loyalty_min_redeem: string;
  loyalty_max_percent: string;    // অর্ডারের কত % পর্যন্ত পয়েন্টে দেওয়া যাবে

  // ── রেফারেল কমিশন ──
  referral_enabled: string;
  referral_percent: string;
  referral_first_only: string;    // শুধু প্রথম অর্ডারে কমিশন
  referral_min_withdraw: string;

  // ── অ্যাব্যান্ডন্ড কার্ট রিমাইন্ডার ──
  ac_enabled: string;
  ac_threshold: string;           // কত মিনিট পরে "অ্যাব্যান্ডন্ড"
  ac_offer_text: string;          // SMS-এ অফার লাইন

  // ── অ্যাকাউন্ট ডিলিট রিকোয়েস্ট ──
  deletion_enabled: string;       // '1' = ইউজার প্রোফাইল থেকে ডিলিট রিকোয়েস্ট পাঠানো যাবে
  deletion_info_text: string;     // ঐচ্ছিক অতিরিক্ত তথ্য (বন্ধ থাকলে contact info দেখানো হয়)
};

// ───────────────────────────── DB Shape ─────────────────────────────

export type DBData = {
  version: number;
  categories: Category[];
  brands: Brand[];
  products: Product[];
  reviews: Review[];
  orders: Order[];
  returnRequests: ReturnRequest[];
  users: User[];
  addresses: Address[];
  roles: Role[];
  notifications: Notification[];
  tickets: SupportTicket[];
  paymentMethods: PaymentMethod[];
  transactions: PaymentTransaction[];
  deliveryZones: DeliveryZone[];
  couriers: Courier[];
  coupons: Coupon[];
  slides: Slide[];
  sideBanners: SideBanner[];
  whyUs: WhyUsItem[];
  testimonials: Testimonial[];
  pages: CmsPage[];
  subscribers: Subscriber[];
  expenses: Expense[];
  media: MediaItem[];
  stockMovements: StockMovement[];
  auditLogs: AuditLog[];
  settings: SiteSettings;
  announcements: Announcement[];
  flashSale: FlashSale;
  // গ্রোথ ও ইন্টিগ্রেশন (v6)
  loyaltyLedger: LoyaltyEntry[];
  referralEvents: ReferralEvent[];
  referralWithdraws: ReferralWithdraw[];
  abandonedCarts: AbandonedCart[];
  smsLogs: SmsLog[];
  pushTokens: PushToken[];
  customGateways: CustomGateway[];
  deletionRequests: DeletionRequest[];
};

export type DBCollection = Exclude<keyof DBData, 'version' | 'settings' | 'flashSale'>;

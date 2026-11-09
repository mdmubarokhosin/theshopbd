/**
 * THE SHOP BD — ডিফল্ট সিড ডেটা
 * ---------------------------------------------------------------------------
 * প্রথমবার চালু হলে এই ডেটা localStorage-এ সিড হয়। এরপর Admin Panel থেকে
 * সবকিছু পরিবর্তন করা যায়। (মূল ডেটা prisma/seed.ts থেকে পোর্ট করা)
 */
import type {
  Category, Brand, Product, ProductVariant, Review,
  PaymentMethod, WhyUsItem, Testimonial, Coupon, Slide, SideBanner,
  DeliveryZone, Courier, CmsPage, Role, User, SiteSettings, Announcement,
  ProductPerk,
} from './types';
import { PERMISSIONS } from './types';

type ColorDef = { name: string; hex?: string }
type VariantSeed = { color: ColorDef | null; size: string | null; price: number; stock: number }
type ProductSeed = {
  name: string
  nameBn: string
  slug: string
  category: string
  brand: string | null
  description: string
  shortDescription: string
  price: number
  comparePrice?: number
  unit: string
  stock?: number
  images: string[]
  colors?: ColorDef[]
  sizes?: string[]
  variants?: VariantSeed[]
  isFeatured?: boolean
  isNew?: boolean
  isBestSeller?: boolean
  isPreOrder?: boolean
  weight?: string
  origin?: string
  rating?: number
  reviewCount?: number
  soldCount?: number
}

const V = (color: ColorDef | string | null, size: string | null, price: number, stock = 40): VariantSeed => ({
  color: typeof color === 'string' ? { name: color } : color,
  size,
  price,
  stock,
})

function combos(
  colors: ColorDef[] | null,
  sizes: string[] | null,
  basePrice: number,
  baseStock = 40,
  overrides?: Record<string, Partial<VariantSeed>>
): VariantSeed[] {
  const list: VariantSeed[] = []
  for (const color of colors || [null]) {
    for (const size of sizes || [null]) {
      const key = `${color?.name || ''}|${size || ''}`
      const ov = overrides?.[key] || {}
      list.push({
        color: color ?? null,
        size,
        price: ov.price ?? basePrice,
        stock: ov.stock ?? baseStock,
      })
    }
  }
  return list
}

// ───────────────────────────── Categories ─────────────────────────────
const categoriesSeed = [
  { name: 'Electronics', nameBn: 'ইলেকট্রনিকস', slug: 'electronics', icon: 'bi-laptop', featured: true, sortOrder: 1 },
  { name: 'Mobile & Tablet', nameBn: 'মোবাইল ও ট্যাবলেট', slug: 'mobile-tablet', icon: 'bi-phone', featured: true, sortOrder: 2 },
  { name: 'Fashion', nameBn: 'ফ্যাশন ও পোশাক', slug: 'fashion', icon: 'bi-handbag', featured: true, sortOrder: 3 },
  { name: 'Home & Living', nameBn: 'ঘর ও লিভিং', slug: 'home-living', icon: 'bi-house-heart', featured: true, sortOrder: 4 },
  { name: 'Beauty & Care', nameBn: 'বিউটি ও পার্সোনাল কেয়ার', slug: 'beauty-care', icon: 'bi-flower1', featured: true, sortOrder: 5 },
  { name: 'Watches & Accessories', nameBn: 'ঘড়ি ও অ্যাকসেসরিজ', slug: 'watches-accessories', icon: 'bi-watch', featured: true, sortOrder: 6 },
  { name: 'Bags & Luggage', nameBn: 'ব্যাগ ও লাগেজ', slug: 'bags-luggage', icon: 'bi-backpack', featured: true, sortOrder: 7 },
  { name: 'Sports & Fitness', nameBn: 'স্পোর্টস ও ফিটনেস', slug: 'sports-fitness', icon: 'bi-trophy', featured: true, sortOrder: 8 },
  { name: 'Baby & Toys', nameBn: 'বেবি ও টয়েজ', slug: 'baby-toys', icon: 'bi-balloon', featured: true, sortOrder: 9 },
  { name: 'Books & Stationery', nameBn: 'বই ও স্টেশনারি', slug: 'books-stationery', icon: 'bi-journal-bookmark', featured: true, sortOrder: 10 },
  { name: 'Grocery', nameBn: 'গ্রোসারি', slug: 'grocery', icon: 'bi-basket', featured: true, sortOrder: 11 },
  { name: 'Office Gadgets', nameBn: 'অফিস ও গ্যাজেট', slug: 'office-gadgets', icon: 'bi-printer', featured: true, sortOrder: 12 },
]

const subCategoriesSeed = [
  { name: 'Audio & Sound', nameBn: 'অডিও ও সাউন্ড', slug: 'audio-sound', icon: 'bi-headphones', parent: 'electronics', sortOrder: 1 },
  { name: 'Smart Gadgets', nameBn: 'স্মার্ট গ্যাজেট', slug: 'smart-gadgets', icon: 'bi-smartwatch', parent: 'electronics', sortOrder: 2 },
  { name: 'Men', nameBn: 'ছেলেদের পোশাক', slug: 'mens-clothing', icon: 'bi-person', parent: 'fashion', sortOrder: 3 },
  { name: 'Panjabi', nameBn: 'পাঞ্জাবি', slug: 'panjabi', icon: 'bi-person-badge', parent: 'mens-clothing', sortOrder: 1 },
  { name: 'Women', nameBn: 'মেয়েদের পোশাক', slug: 'womens-clothing', icon: 'bi-person-standing-dress', parent: 'fashion', sortOrder: 4 },
  { name: 'Shoes', nameBn: 'জুতা', slug: 'shoes', icon: 'bi-bag', parent: 'fashion', sortOrder: 5 },
]

// ───────────────────────────── Brands ─────────────────────────────
const brandLogo = (slug: string) => `/brands/${slug}.svg`
const brandsSeed = [
  { name: 'Samsung', nameBn: 'স্যামসাং', slug: 'samsung' },
  { name: 'Xiaomi', nameBn: 'শাওমি', slug: 'xiaomi' },
  { name: 'Walton', nameBn: 'ওয়ালটন', slug: 'walton' },
  { name: 'Symphony', nameBn: 'সিম্ফনি', slug: 'symphony' },
  { name: 'Havit', nameBn: 'হ্যাভিট', slug: 'havit' },
  { name: 'Aarong', nameBn: 'আরং', slug: 'aarong' },
  { name: 'Sailor', nameBn: 'সেইলর', slug: 'sailor' },
  { name: 'Ecstasy', nameBn: 'এক্সটেসি', slug: 'ecstasy' },
  { name: 'Apex', nameBn: 'এপেক্স', slug: 'apex' },
  { name: 'Bata', nameBn: 'বাটা', slug: 'bata' },
  { name: 'Lotto', nameBn: 'লোটো', slug: 'lotto' },
  { name: 'Vision', nameBn: 'ভিশন', slug: 'vision' },
  { name: 'RFL', nameBn: 'আরএফএল', slug: 'rfl' },
  { name: 'Pran', nameBn: 'প্রাণ', slug: 'pran' },
  { name: 'Fresh', nameBn: 'ফ্রেশ', slug: 'fresh' },
  { name: 'Singer', nameBn: 'সিঙ্গার', slug: 'singer' },
  { name: 'Kumarika', nameBn: 'কুমারিকা', slug: 'kumarika' },
  { name: 'Tibet', nameBn: 'তিবেট', slug: 'tibet' },
  { name: 'Meril', nameBn: 'মেরিল', slug: 'meril' },
  { name: 'Matador', nameBn: 'ম্যাটাডোর', slug: 'matador' },
  { name: 'Toy Land', nameBn: 'টয় ল্যান্ড', slug: 'toy-land' },
]

// ───────────────────── Payment Methods ─────────────────────
const paymentMethodsSeed = [
  { name: 'বিকাশ (bKash)', logo: '/payments/bkash.svg', accountNumber: '01711-000111 (পার্সোনাল)', instructions: 'Send Money করে Transaction ID দিন', sortOrder: 1 },
  { name: 'নগদ (Nagad)', logo: '/payments/nagad.svg', accountNumber: '01711-000222 (পার্সোনাল)', instructions: 'Send Money করে Transaction ID দিন', sortOrder: 2 },
  { name: 'রকেট (Rocket)', logo: '/payments/rocket.svg', accountNumber: '017110003336 (পার্সোনাল)', instructions: 'Send Money করে Transaction ID দিন', sortOrder: 3 },
  { name: 'ভিসা / মাস্টারকার্ড', logo: '/payments/visa.svg', accountNumber: null, instructions: 'অনলাইন কার্ড পেমেন্ট গেটওয়ে', sortOrder: 4 },
  { name: 'মাস্টারকার্ড', logo: '/payments/mastercard.svg', accountNumber: null, instructions: 'অনলাইন কার্ড পেমেন্ট গেটওয়ে', sortOrder: 5 },
  { name: 'ক্যাশ অন ডেলিভারি', logo: '/payments/cod.svg', accountNumber: null, instructions: 'পণ্য হাতে পেয়ে টাকা পরিশোধ করুন', sortOrder: 6 },
]

// ───────────────────────────── Products ─────────────────────────────
const productsSeed: ProductSeed[] = [
  // ── অডিও ও সাউন্ড ──
  {
    name: 'Havit TW927 True Wireless Earbuds',
    nameBn: 'হ্যাভিট TW927 ট্রু ওয়্যারলেস ইয়ারবাডস',
    slug: 'havit-tw927-tws-earbuds',
    category: 'audio-sound', brand: 'havit',
    shortDescription: 'ব্লুটুথ ৫.৩, ২০ ঘণ্টা প্লেব্যাক, ENC কলিং নয়েজ রিডাকশন',
    description: 'হ্যাভিট TW927 ট্রু ওয়্যারলেস ইয়ারবাডস — ব্লুটুথ ৫.৩ কানেকশন, সুপার ফাস্ট পেয়ারিং এবং অসাধারণ সাউন্ড কোয়ালিটি।\n\nবৈশিষ্ট্য:\n• ব্লুটুথ ৫.৩ — স্থিতিশীল ও দ্রুত কানেকশন\n• ২০ ঘণ্টা পর্যন্ত টোটাল প্লেব্যাক (চার্জিং কেস সহ)\n• ENC এনভায়রনমেন্টাল নয়েজ ক্যান্সেলেশন মাইক\n• টাচ কন্ট্রোল — মিউজিক ও কল কন্ট্রোল\n• USB Type-C ফাস্ট চার্জিং\n• IPX4 স্প্ল্যাশ প্রুফ — জিম ও রানিংয়ের জন্য পারফেক্ট\n\n১ বছরের রিপ্লেসমেন্ট ওয়ারেন্টি সহ অফিসিয়াল ইমপোর্টেড পণ্য।',
    price: 1350, comparePrice: 1990, unit: 'পিস', stock: 60,
    images: ['/products/earbuds.png', '/products/speaker.png', '/products/smartwatch.png'],
    colors: [
      { name: 'কালো', hex: '#1a1a1a' },
      { name: 'সাদা', hex: '#f5f5f5' },
      { name: 'নীল', hex: '#1e63d0' },
    ],
    variants: combos([{ name: 'কালো', hex: '#1a1a1a' }, { name: 'সাদা', hex: '#f5f5f5' }, { name: 'নীল', hex: '#1e63d0' }], null, 1350, 25),
    isFeatured: true, isNew: true, isBestSeller: true, rating: 4.6, reviewCount: 128, soldCount: 540,
    origin: 'China', weight: '২৫০ গ্রাম (কেস সহ)',
  },
  {
    name: 'Havit SK810 Bluetooth Speaker',
    nameBn: 'হ্যাভিট SK810 ব্লুটুথ স্পিকার',
    slug: 'havit-sk810-bluetooth-speaker',
    category: 'audio-sound', brand: 'havit',
    shortDescription: '১০W ডিপ বেস সাউন্ড, ৮ ঘণ্টা প্লেটাইম, AUX/TF/USB সাপোর্ট',
    description: 'হ্যাভিট SK810 পোর্টেবল ব্লুটুথ স্পিকার — ১০ ওয়াট ডিপ বেস সাউন্ড ড্রাইভার।\n\nবৈশিষ্ট্য:\n• ১০W হাই-ক্লিয়ারিটি স্পিকার ড্রাইভার\n• ৮ ঘণ্টা পর্যন্ত কন্টিনিউয়াস প্লেটাইম\n• ব্লুটুথ ৫.০, AUX, TF কার্ড ও USB সাপোর্ট\n• বিল্ট-ইন মাইক — হ্যান্ডস-ফ্রি কলিং\n• কমপ্যাক্ট ডিজাইন — বাইরে যেকোনো জায়গায় বহনযোগ্য\n\n৬ মাসের সার্ভিস ওয়ারেন্টি।',
    price: 2250, comparePrice: 2800, unit: 'পিস', stock: 35,
    images: ['/products/speaker.png'],
    colors: [{ name: 'কালো', hex: '#1a1a1a' }, { name: 'নীল', hex: '#1e63d0' }, { name: 'লাল', hex: '#d32f2f' }],
    variants: combos([{ name: 'কালো', hex: '#1a1a1a' }, { name: 'নীল', hex: '#1e63d0' }, { name: 'লাল', hex: '#d32f2f' }], null, 2250, 15),
    isFeatured: true, rating: 4.4, reviewCount: 76, soldCount: 210,
    origin: 'China',
  },
  {
    name: 'Xiaomi Power Bank 20000mAh',
    nameBn: 'শাওমি পাওয়ার ব্যাংক ২০০০০mAh',
    slug: 'xiaomi-powerbank-20000',
    category: 'mobile-tablet', brand: 'xiaomi',
    shortDescription: '২২.৫W ফাস্ট চার্জিং, ডিজিটাল ডিসপ্লে, ডুয়াল USB আউটপুট',
    description: 'শাওমি ২০০০০mAh পাওয়ার ব্যাংক — ২২.৫ ওয়াট সুপার ফাস্ট চার্জিং।\n\nবৈশিষ্ট্য:\n• ২০০০০mAh হাই-ক্যাপাসিটি লিথিয়াম পলিমার ব্যাটারি\n• ২২.৫W ফাস্ট চার্জিং (Type-C ইনপুট/আউটপুট)\n• ডিজিটাল পারসেন্টেজ ডিসপ্লে\n• ডুয়াল USB-A + Type-C আউটপুট — একসাথে ৩ ডিভাইস চার্জ\n• মাল্টি-প্রোটেকশন — ওভারচার্জ, শর্ট সার্কিট প্রোটেকশন\n\n৬ মাসের ওয়ারেন্টি সহ।',
    price: 1850, comparePrice: 2200, unit: 'পিস', stock: 50,
    images: ['/products/powerbank.png', '/products/smartphone.png'],
    colors: [{ name: 'কালো', hex: '#1a1a1a' }, { name: 'সাদা', hex: '#f5f5f5' }],
    variants: combos([{ name: 'কালো', hex: '#1a1a1a' }, { name: 'সাদা', hex: '#f5f5f5' }], null, 1850, 25),
    isFeatured: true, isBestSeller: true, rating: 4.7, reviewCount: 154, soldCount: 480,
    origin: 'China',
  },
  {
    name: 'Symphony G22 Smartphone (4/64GB)',
    nameBn: 'সিম্ফনি G22 স্মার্টফোন',
    slug: 'symphony-g22-smartphone',
    category: 'mobile-tablet', brand: 'symphony',
    shortDescription: '৬.৬" HD+ ডিসপ্লে, ৪GB RAM, ৫০০০mAh ব্যাটারি, স্টোরেজ ভ্যারিয়েন্ট সহ',
    description: 'সিম্ফনি G22 — বাংলাদেশের জনপ্রিয় বাজেট ফ্রেন্ডলি স্মার্টফোন।\n\nবৈশিষ্ট্য:\n• ৬.৬ ইঞ্চি HD+ ইনফিনিটি-ইউ ডিসপ্লে\n• অক্টা-কোর প্রসেসর, ৪GB RAM (+৪GB এক্সটেন্ডেড)\n• স্টোরেজ ভ্যারিয়েন্ট: ৬৪GB / ১২৮GB (নির্বাচনযোগ্য)\n• ৫০০০mAh বড় ব্যাটারি — সারাদিন ব্যাকআপ\n• ১৩MP মেইন ক্যামেরা + ৮MP সেলফি ক্যামেরা\n• ফেস আনলক ও ফিঙ্গারপ্রিন্ট সেন্সর\n• ডুয়াল সিম (4G VoLTE)\n\n১ বছরের অফিসিয়াল ওয়ারেন্টি।',
    price: 8499, comparePrice: 9500, unit: 'পিস', stock: 25,
    images: ['/products/smartphone.png', '/products/powerbank.png', '/products/earbuds.png'],
    colors: [{ name: 'মিডনাইট ব্লু', hex: '#1e3a5f' }, { name: 'গ্রে', hex: '#9e9e9e' }],
    sizes: ['৬৪GB', '১২৮GB'],
    variants: combos([{ name: 'মিডনাইট ব্লু', hex: '#1e3a5f' }, { name: 'গ্রে', hex: '#9e9e9e' }], ['৬৪GB', '১২৮GB'], 8499, 12, {
      'মিডনাইট ব্লু|১২৮GB': { price: 9499 },
      'গ্রে|১২৮GB': { price: 9499 },
    }),
    isFeatured: true, isNew: true, rating: 4.3, reviewCount: 89, soldCount: 320,
    origin: 'Bangladesh',
  },
  {
    name: 'Haylou Smart Watch RS1',
    nameBn: 'হেইলু স্মার্ট ওয়াচ RS1',
    slug: 'haylou-smart-watch-rs1',
    category: 'smart-gadgets', brand: 'xiaomi',
    shortDescription: '১.৪" কালার ডিসপ্লে, হার্ট রেট ও SpO2 মনিটর, ১০+ স্পোর্টস মোড',
    description: 'হেইলু RS1 স্মার্ট ওয়াচ — স্বাস্থ্য ও ফিটনেসের সব সুবিধা হাতের মুঠোয়।\n\nবৈশিষ্ট্য:\n• ১.৪ ইঞ্চি HD কালার টাচ ডিসপ্লে\n• ২৪ ঘণ্টা হার্ট রেট মনিটরিং\n• SpO2 (রক্তে অক্সিজেন) মাপার\n• ১০+ স্পোর্টস মোড — ওয়াকিং, রানিং, সাইক্লিং সহ\n• ঘুমের মান বিশ্লেষণ\n• ১২ দিন পর্যন্ত ব্যাটারি ব্যাকআপ\n• IP68 ওয়াটার রেজিস্ট্যান্ট\n\n৬ মাসের রিপ্লেসমেন্ট ওয়ারেন্টি।',
    price: 2990, comparePrice: 3500, unit: 'পিস', stock: 40,
    images: ['/products/smartwatch.png', '/products/analog-watch.png', '/products/earbuds.png'],
    colors: [{ name: 'কালো', hex: '#1a1a1a' }, { name: 'সিলভার', hex: '#c0c0c0' }],
    variants: combos([{ name: 'কালো', hex: '#1a1a1a' }, { name: 'সিলভার', hex: '#c0c0c0' }], null, 2990, 20),
    isFeatured: true, isBestSeller: true, rating: 4.5, reviewCount: 203, soldCount: 650,
    origin: 'China',
  },
  {
    name: 'Havit KB500 Mechanical Gaming Keyboard',
    nameBn: 'হ্যাভিট KB500 মেকানিক্যাল গেমিং কীবোর্ড',
    slug: 'havit-kb500-mechanical-keyboard',
    category: 'office-gadgets', brand: 'havit',
    shortDescription: 'RGB ব্যাকলিট, ব্লু সুইচ, ৮৭ কি টেনকি-লেআউট',
    description: 'হ্যাভিট KB500 মেকানিক্যাল গেমিং কীবোর্ড — গেমারদের জন্য পারফেক্ট চয়েস।\n\nবৈশিষ্ট্য:\n• ব্লু মেকানিক্যাল সুইচ — ক্লিকি ট্যাকটাইল ফিল\n• RGB রেইনবো ব্যাকলিট (১৫+ লাইটিং ইফেক্ট)\n• ৮৭ কি কমপ্যাক্ট টেনকি-লেআউট\n• ডাবল-শট অ্যাবসর্বেন্ট কি-ক্যাপ\n• অ্যান্টি-ঘোস্টিং ফুল-কি রোলওভার\n• ব্রেইডেড USB কেবল\n\n১ বছরের ওয়ারেন্টি।',
    price: 2450, comparePrice: 2990, unit: 'পিস', stock: 30,
    images: ['/products/keyboard.png'],
    colors: [{ name: 'সাদা', hex: '#f5f5f5' }, { name: 'কালো', hex: '#1a1a1a' }],
    variants: combos([{ name: 'সাদা', hex: '#f5f5f5' }, { name: 'কালো', hex: '#1a1a1a' }], null, 2450, 15),
    isNew: true, rating: 4.4, reviewCount: 47, soldCount: 130,
    origin: 'China',
  },
  {
    name: 'Havit Aluminium Laptop Stand',
    nameBn: 'হ্যাভিট অ্যালুমিনিয়াম ল্যাপটপ স্ট্যান্ড',
    slug: 'havit-aluminium-laptop-stand',
    category: 'office-gadgets', brand: 'havit',
    shortDescription: '৬-লেভেল অ্যাডজাস্টেবল, ১০-১৭ ইঞ্চি ল্যাপটপের জন্য',
    description: 'হ্যাভিট অ্যালুমিনিয়াম ল্যাপটপ স্ট্যান্ড — সঠিক পোশাচারে কাজ করুন।\n\nবৈশিষ্ট্য:\n• ৬-লেভেল হাইট অ্যাডজাস্টেবল\n• প্রিমিয়াম অ্যালুমিনিয়াম অ্যালয় বডি\n• ১০ থেকে ১৭ ইঞ্চি সব ল্যাপটপে সাপোর্ট\n• সিলিকন প্যাড — স্লিপ-প্রুফ গ্রিপ\n• ফোল্ডেবল ডিজাইন — সহজে বহনযোগ্য\n• হিট ডিসিপেশন ভেন্টিলেশন\n\n৬ মাসের ওয়ারেন্টি।',
    price: 1290, comparePrice: 1690, unit: 'পিস', stock: 45,
    images: ['/products/laptop-stand.png'],
    isFeatured: false, rating: 4.6, reviewCount: 58, soldCount: 240,
    origin: 'China',
  },

  // ── ছেলেদের পোশাক ──
  {
    name: 'Sailor Premium Cotton Panjabi',
    nameBn: 'সেইলর প্রিমিয়াম কটন প্যানজাবি',
    slug: 'sailor-premium-cotton-panjabi',
    category: 'panjabi', brand: 'sailor',
    shortDescription: '১০০% এক্সপোর্ট কোয়ালিটি কটন, কলার এমব্রয়ডারি, ফুল স্লিভ',
    description: 'সেইলর প্রিমিয়াম কটন প্যানজাবি — ঈদ ও নিয়মিত পরিধানের জন্য আদর্শ।\n\nবৈশিষ্ট্য:\n• ১০০% এক্সপোর্ট কোয়ালিটি কটন ফেব্রিক\n• কলারে সুন্দর এমব্রয়ডারি ওয়ার্ক\n• ফুল স্লিভ — রেগুলার ফিট\n• ৪টি আকর্ষণীয় রং: সাদা, কালো, নেভি নীল, মেরুন\n• সাইজ: ৩৮, ৪০, ৪২, ৪৪\n• মেশিন ওয়াশেবল, রং উড়ে না যাওয়ার নিশ্চয়তা\n\nসঠিক সাইজ বাছাইয়ের জন্য সাইজ চার্ট দেখে অর্ডার করুন।',
    price: 1690, comparePrice: 2200, unit: 'পিস', stock: 80,
    images: ['/products/panjabi.png', '/products/shirt.png', '/products/kurti.png'],
    colors: [
      { name: 'সাদা', hex: '#f5f5f5' },
      { name: 'কালো', hex: '#1a1a1a' },
      { name: 'নেভি নীল', hex: '#1e3a5f' },
      { name: 'মেরুন', hex: '#7b1e26' },
    ],
    sizes: ['৩৮', '৪০', '৪২', '৪৪'],
    variants: combos(
      [{ name: 'সাদা', hex: '#f5f5f5' }, { name: 'কালো', hex: '#1a1a1a' }, { name: 'নেভি নীল', hex: '#1e3a5f' }, { name: 'মেরুন', hex: '#7b1e26' }],
      ['৩৮', '৪০', '৪২', '৪৪'], 1690, 8
    ),
    isFeatured: true, isBestSeller: true, rating: 4.5, reviewCount: 167, soldCount: 890,
    origin: 'Bangladesh',
  },
  {
    name: 'Ecstasy Casual Check Shirt',
    nameBn: 'Ecstasy ক্যাজুয়াল চেক শার্ট',
    slug: 'ecstasy-casual-check-shirt',
    category: 'mens-clothing', brand: 'ecstasy',
    shortDescription: 'প্রিমিয়াম কটন চেক ফেব্রিক, স্লিম ফিট, অফিস ও আউটিংয়ের জন্য',
    description: 'Ecstasy ক্যাজুয়াল চেক শার্ট — ট্রেন্ডি লুকের জন্য পারফেক্ট।\n\nবৈশিষ্ট্য:\n• প্রিমিয়াম কটন চেক ফেব্রিক\n• স্লিম ফিট — মডার্ন ফ্যাশনেবল লুক\n• স্প্রেড কলার, ফুল স্লিভ উইথ কাফ বাটন\n• ৩টি রং: নেভি, অলিভ, স্কাই ব্লু\n• সাইজ: M, L, XL, XXL\n\nকোল্ড মেশিন ওয়াশ করুন।',
    price: 1290, comparePrice: 1650, unit: 'পিস', stock: 70,
    images: ['/products/shirt.png'],
    colors: [
      { name: 'নেভি', hex: '#1e3a5f' },
      { name: 'অলিভ', hex: '#6b7d3a' },
      { name: 'স্কাই ব্লু', hex: '#87ceeb' },
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    variants: combos(
      [{ name: 'নেভি', hex: '#1e3a5f' }, { name: 'অলিভ', hex: '#6b7d3a' }, { name: 'স্কাই ব্লু', hex: '#87ceeb' }],
      ['M', 'L', 'XL', 'XXL'], 1290, 6
    ),
    isFeatured: true, isNew: true, rating: 4.3, reviewCount: 92, soldCount: 410,
    origin: 'Bangladesh',
  },
  {
    name: 'Classic Denim Jeans Pant',
    nameBn: 'ক্লাসিক ডেনিম জিন্স প্যান্ট',
    slug: 'classic-denim-jeans-pant',
    category: 'mens-clothing', brand: 'sailor',
    shortDescription: 'ডেনিম ফেব্রিক, ৫-পকেট স্টাইল, রেগুলার ফিট',
    description: 'ক্লাসিক ডেনিম জিন্স প্যান্ট — সব বয়সের জন্য টাইমলেস পছন্দ।\n\nবৈশিষ্ট্য:\n• হাই-কোয়ালিটি ডেনিম ফেব্রিক\n• ক্লাসিক ৫-পকেট স্টাইল\n• রেগুলার ফিট — সব বডি টাইপে আরামদায়ক\n• রং: ইন্ডিগো নীল, কালো\n• ওয়েস্ট সাইজ: ৩০, ৩২, ৩৪, ৩৬ ইঞ্চি\n• জিপার ক্লোজার উইথ বাটন\n\nমেশিন ওয়াশেবল।',
    price: 1850, comparePrice: 2400, unit: 'পিস', stock: 60,
    images: ['/products/jeans.png'],
    colors: [{ name: 'নীল', hex: '#3b5998' }, { name: 'কালো', hex: '#1a1a1a' }],
    sizes: ['৩০', '৩২', '৩৪', '৩৬'],
    variants: combos([{ name: 'নীল', hex: '#3b5998' }, { name: 'কালো', hex: '#1a1a1a' }], ['৩০', '৩২', '৩৪', '৩৬'], 1850, 8),
    isBestSeller: true, rating: 4.4, reviewCount: 121, soldCount: 520,
    origin: 'Bangladesh',
  },
  {
    name: 'Ecstasy Winter Hoodie',
    nameBn: 'Ecstasy উইন্টার হুডি',
    slug: 'ecstasy-winter-hoodie',
    category: 'mens-clothing', brand: 'ecstasy',
    shortDescription: 'ফ্লিস ভেতর, কাংগারু পকেট, ড্র-স্ট্রিং হুড',
    description: 'Ecstasy উইন্টার হুডি — শীতের জন্য আরামদায়ক ও স্টাইলিশ।\n\nবৈশিষ্ট্য:\n• নরম ফ্লিস ভেতরের লেয়ার — উষ্ণ ও আরামদায়ক\n• কাংগারু পকেট\n• অ্যাডজাস্টেবল ড্র-স্ট্রিং হুড\n• রং: অলিভ, কালো, মেরুন\n• সাইজ: M, L, XL\n\nকোল্ড ওয়াটারে ধুয়ে রোদে শুকান।',
    price: 1990, comparePrice: 2500, unit: 'পিস', stock: 50,
    images: ['/products/hoodie.png'],
    colors: [
      { name: 'অলিভ', hex: '#6b7d3a' },
      { name: 'কালো', hex: '#1a1a1a' },
      { name: 'মেরুন', hex: '#7b1e26' },
    ],
    sizes: ['M', 'L', 'XL'],
    variants: combos([{ name: 'অলিভ', hex: '#6b7d3a' }, { name: 'কালো', hex: '#1a1a1a' }, { name: 'মেরুন', hex: '#7b1e26' }], ['M', 'L', 'XL'], 1990, 6),
    isNew: true, rating: 4.5, reviewCount: 64, soldCount: 280,
    origin: 'Bangladesh',
  },
  {
    name: 'Premium Cotton Half Sleeve T-Shirt',
    nameBn: 'প্রিমিয়াম কটন হাফ স্লিভ টি-শার্ট',
    slug: 'premium-cotton-half-sleeve-tshirt',
    category: 'mens-clothing', brand: 'sailor',
    shortDescription: '১৮০ GSM কম্বড কটন, প্রি-শ্রাংক, রেগুলার ফিট',
    description: 'প্রিমিয়াম কটন টি-শার্ট — প্রতিদিনের আরামদায়ক পছন্দ।\n\nবৈশিষ্ট্য:\n• ১৮০ GSM কম্বড কটন ফেব্রিক\n• প্রি-শ্রাংক — ধোয়ার পর সাইজ কমবে না\n• রাউন্ড নেক, হাফ স্লিভ\n• ৪টি রং: সাদা, কালো, নেভি, লাল\n• সাইজ: M, L, XL, XXL\n\nরেগুলার ফিট — সব ধরনের ডেইলি ব্যবহারের জন্য আদর্শ।',
    price: 550, comparePrice: 750, unit: 'পিস', stock: 120,
    images: ['/products/tshirt.png'],
    colors: [
      { name: 'সাদা', hex: '#f5f5f5' },
      { name: 'কালো', hex: '#1a1a1a' },
      { name: 'নেভি', hex: '#1e3a5f' },
      { name: 'লাল', hex: '#d32f2f' },
    ],
    sizes: ['M', 'L', 'XL', 'XXL'],
    variants: combos(
      [{ name: 'সাদা', hex: '#f5f5f5' }, { name: 'কালো', hex: '#1a1a1a' }, { name: 'নেভি', hex: '#1e3a5f' }, { name: 'লাল', hex: '#d32f2f' }],
      ['M', 'L', 'XL', 'XXL'], 550, 10
    ),
    isBestSeller: true, rating: 4.2, reviewCount: 245, soldCount: 1200,
    origin: 'Bangladesh',
  },

  // ── মেয়েদের পোশাক ──
  {
    name: 'Aarong Block Print Salwar Kameez',
    nameBn: 'আরং ব্লক প্রিন্ট সালোয়ার কামিজ',
    slug: 'aarong-block-print-salwar-kameez',
    category: 'womens-clothing', brand: 'aarong',
    shortDescription: '৩ পিস সেট, ব্লক প্রিন্ট কটন, ডুপাটা সহ',
    description: 'আরং ব্লক প্রিন্ট সালোয়ার কামিজ — ঐতিহ্যবাহী হাতে বানানো ব্লক প্রিন্ট।\n\nসেটে থাকছে:\n• কামিজ — ব্লক প্রিন্টেড কটন\n• সালোয়ার\n• ম্যাচিং ডুপাটা\n\nবৈশিষ্ট্য:\n• ১০০% হ্যান্ড ব্লক প্রিন্টেড কটন ফেব্রিক\n• রং: লাল, সবুজ, নীল\n• সাইজ: S, M, L, XL\n• আরামদায়ক ফিট, সব অনুষ্ঠানে পরার মতো\n\nপ্রথম ২-৩ বার আলাদা করে হাতে ধোয়া ভালো।',
    price: 2890, comparePrice: 3500, unit: 'সেট', stock: 40,
    images: ['/products/salwar-kameez.png'],
    colors: [
      { name: 'লাল', hex: '#d32f2f' },
      { name: 'সবুজ', hex: '#2e7d32' },
      { name: 'নীল', hex: '#1e63d0' },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    variants: combos([{ name: 'লাল', hex: '#d32f2f' }, { name: 'সবুজ', hex: '#2e7d32' }, { name: 'নীল', hex: '#1e63d0' }], ['S', 'M', 'L', 'XL'], 2890, 4),
    isFeatured: true, rating: 4.7, reviewCount: 88, soldCount: 350,
    origin: 'Bangladesh',
  },
  {
    name: 'Aarong Silk Saree',
    nameBn: 'আরং সিল্ক শাড়ি',
    slug: 'aarong-silk-saree',
    category: 'womens-clothing', brand: 'aarong',
    shortDescription: 'প্রিমিয়াম সিল্ক, গোল্ডেন বর্ডার, ব্লাউজ পিস সহ',
    description: 'আরং প্রিমিয়াম সিল্ক শাড়ি — বিয়ে ও অনুষ্ঠানের জন্য আদর্শ।\n\nবৈশিষ্ট্য:\n• প্রিমিয়াম সিল্ক ফেব্রিক\n• গোল্ডেন জরি বর্ডার ওয়ার্ক\n• ম্যাচিং ব্লাউজ পিস (আনস্টিচড) সহ\n• শাড়ির দৈর্ঘ্য: ৫.৫ হাত, ব্লাউজ পিস: ০.৮ হাত\n• রিচ গ্রিন কালার\n\nড্রাই ক্লিন করার পরামর্শ দেওয়া হচ্ছে।',
    price: 4500, comparePrice: 5800, unit: 'পিস', stock: 20,
    images: ['/products/saree.png'],
    isFeatured: true, rating: 4.8, reviewCount: 42, soldCount: 160,
    origin: 'Bangladesh',
  },
  {
    name: 'Printed Cotton Kurti',
    nameBn: 'প্রিন্টেড কটন কুর্তি',
    slug: 'printed-cotton-kurti',
    category: 'womens-clothing', brand: 'aarong',
    shortDescription: 'সফট কটন, ফুল প্রিন্ট, ডেইলি ও অফিস ওয়্যার',
    description: 'প্রিন্টেড কটন কুর্তি — দৈনন্দিন পরিধানের জন্য আরামদায়ক।\n\nবৈশিষ্ট্য:\n• সফট ও হালকা কটন ফেব্রিক\n• অল-ওভার ফ্লোরাল প্রিন্ট\n• থ্রি-কোয়ার্টার স্লিভ\n• রং: টিল, গোলাপি, বেগুনি\n• সাইজ: S, M, L, XL\n• লেন্থ: ৪২ ইঞ্চি\n\nমেশিন ওয়াশেবল।',
    price: 1150, comparePrice: 1500, unit: 'পিস', stock: 70,
    images: ['/products/kurti.png'],
    colors: [
      { name: 'টিল', hex: '#008080' },
      { name: 'গোলাপি', hex: '#e91e63' },
      { name: 'বেগুনি', hex: '#7b1fa2' },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    variants: combos([{ name: 'টিল', hex: '#008080' }, { name: 'গোলাপি', hex: '#e91e63' }, { name: 'বেগুনি', hex: '#7b1fa2' }], ['S', 'M', 'L', 'XL'], 1150, 5),
    isNew: true, rating: 4.4, reviewCount: 76, soldCount: 380,
    origin: 'Bangladesh',
  },

  // ── জুতা ──
  {
    name: 'Bata Sports Sneakers',
    nameBn: 'বাটা স্পোর্টস স্নিকার্স',
    slug: 'bata-sports-sneakers',
    category: 'shoes', brand: 'bata',
    shortDescription: 'হালকা ওজন, নন-স্লিপ সোল, ব্রিদেবল মেশ আপার',
    description: 'বাটা স্পোর্টস স্নিকার্স — রানিং, ওয়াকিং ও ডেইলি ইউজের জন্য।\n\nবৈশিষ্ট্য:\n• ব্রিদেবল মেশ আপার — পা ঠান্ডা ও শুকনো থাকে\n• নন-স্লিপ রাবার আউটসোল\n• কুশনড ইনসোল — দীর্ঘ হাঁটাতেও আরাম\n• হালকা ওজন ডিজাইন\n• রং: সাদা-লাল, কালো\n• সাইজ: ৩৯, ৪০, ৪১, ৪২, ৪৩, ৪৪ (UK)\n\n৬ মাসের ওয়ারেন্টি (সোল ও স্টিচিং)।',
    price: 2290, comparePrice: 2900, unit: 'জোড়া', stock: 60,
    images: ['/products/sneakers.png', '/products/formal-shoes.png', '/products/backpack.png'],
    colors: [{ name: 'সাদা-লাল', hex: '#f5f5f5' }, { name: 'কালো', hex: '#1a1a1a' }],
    sizes: ['৩৯', '৪০', '৪১', '৪২', '৪৩', '৪৪'],
    variants: combos([{ name: 'সাদা-লাল', hex: '#f5f5f5' }, { name: 'কালো', hex: '#1a1a1a' }], ['৩৯', '৪০', '৪১', '৪২', '৪৩', '৪৪'], 2290, 5),
    isFeatured: true, isBestSeller: true, rating: 4.5, reviewCount: 189, soldCount: 720,
    origin: 'Vietnam',
  },
  {
    name: 'Apex Formal Leather Shoes',
    nameBn: 'এপেক্স ফরমাল লেদার জুতা',
    slug: 'apex-formal-leather-shoes',
    category: 'shoes', brand: 'apex',
    shortDescription: 'জেনুইন লেদার, লেস-আপ ডিজাইন, অফিস ও ফরমাল ইভেন্টের জন্য',
    description: 'এপেক্স ফরমাল লেদার জুতা — প্রফেশনাল লুকের পারফেক্ট সঙ্গী।\n\nবৈশিষ্ট্য:\n• জেনুইন লেদার আপার\n• ক্লাসিক লেস-আপ ডিজাইন\n• কুশনড ফুটবেড\n• টেক্সচারড রাবার সোল — নন-স্লিপ\n• রং: বাদামি, কালো\n• সাইজ: ৩৯, ৪০, ৪১, ৪২, ৪৩, ৪৪ (UK)\n\nলেদার পলিশ রেগুলার ব্যবহার করুন।',
    price: 3290, comparePrice: 4000, unit: 'জোড়া', stock: 40,
    images: ['/products/formal-shoes.png'],
    colors: [{ name: 'বাদামি', hex: '#5d3a1a' }, { name: 'কালো', hex: '#1a1a1a' }],
    sizes: ['৩৯', '৪০', '৪১', '৪২', '৪৩', '৪৪'],
    variants: combos([{ name: 'বাদামি', hex: '#5d3a1a' }, { name: 'কালো', hex: '#1a1a1a' }], ['৩৯', '৪০', '৪১', '৪২', '৪৩', '৪৪'], 3290, 4),
    rating: 4.6, reviewCount: 97, soldCount: 310,
    origin: 'Bangladesh',
  },

  // ── ঘড়ি ও অ্যাকসেসরিজ ──
  {
    name: 'Apex Quartz Analog Watch',
    nameBn: 'এপেক্স কোয়ার্টজ অ্যানালগ ওয়াচ',
    slug: 'apex-quartz-analog-watch',
    category: 'watches-accessories', brand: 'apex',
    shortDescription: 'জাপানি মুভমেন্ট, লেদার স্ট্র্যাপ, ওয়াটার রেজিস্ট্যান্ট',
    description: 'এপেক্স কোয়ার্টজ অ্যানালগ ওয়াচ — ক্লাসিক ডিজাইনে আধুনিক টেকনোলজি।\n\nবৈশিষ্ট্য:\n• জাপানি কোয়ার্টজ মুভমেন্ট\n• জেনুইন লেদার স্ট্র্যাপ\n• ৩০m ওয়াটার রেজিস্ট্যান্ট\n• মিনিমাল ডায়াল ডিজাইন\n• রং: কালো স্ট্র্যাপ, বাদামি স্ট্র্যাপ\n• ১ বছরের মুভমেন্ট ওয়ারেন্টি',
    price: 2450, comparePrice: 3000, unit: 'পিস', stock: 35,
    images: ['/products/analog-watch.png'],
    colors: [{ name: 'কালো স্ট্র্যাপ', hex: '#1a1a1a' }, { name: 'বাদামি স্ট্র্যাপ', hex: '#5d3a1a' }],
    variants: combos([{ name: 'কালো স্ট্র্যাপ', hex: '#1a1a1a' }, { name: 'বাদামি স্ট্র্যাপ', hex: '#5d3a1a' }], null, 2450, 15),
    isFeatured: true, rating: 4.5, reviewCount: 73, soldCount: 260,
    origin: 'Bangladesh',
  },
  {
    name: 'Vision Genuine Leather Wallet',
    nameBn: 'ভিশন জেনুইন লেদার ওয়ালেট',
    slug: 'vision-genuine-leather-wallet',
    category: 'watches-accessories', brand: 'vision',
    shortDescription: '১০০% জেনুইন লেদার, RFID প্রোটেকশন, ৮+ কার্ড স্লট',
    description: 'ভিশন জেনুইন লেদার ওয়ালেট — প্রিমিয়াম কোয়ালিটি বাইফোল্ড ওয়ালেট।\n\nবৈশিষ্ট্য:\n• ১০০% জেনুইন কাউ লেদার\n• RFID ব্লকিং প্রোটেকশন — কার্ড স্কিমিং থেকে সুরক্ষা\n• ৮+ কার্ড স্লট, ২টি বিল কম্পার্টমেন্ট\n• ১টি জিপার কয়েন পকেট\n• স্লিম প্রোফাইল ডিজাইন\n• কালো কালার\n\n৬ মাসের ওয়ারেন্টি।',
    price: 890, comparePrice: 1200, unit: 'পিস', stock: 65,
    images: ['/products/wallet.png'],
    isBestSeller: true, rating: 4.6, reviewCount: 112, soldCount: 480,
    origin: 'Bangladesh',
  },

  // ── ব্যাগ ও লাগেজ ──
  {
    name: 'Vision Laptop Backpack 30L',
    nameBn: 'ভিশন ল্যাপটপ ব্যাকপ্যাক ৩০L',
    slug: 'vision-laptop-backpack-30l',
    category: 'bags-luggage', brand: 'vision',
    shortDescription: '১৫.৬" ল্যাপটপ কম্পার্টমেন্ট, ওয়াটার রেজিস্ট্যান্ট, USB পোর্ট',
    description: 'ভিশন ল্যাপটপ ব্যাকপ্যাক — অফিস, কলেজ ও ট্রাভেলের জন্য পারফেক্ট।\n\nবৈশিষ্ট্য:\n• ৩০ লিটার ক্যাপাসিটি\n• ১৫.৬ ইঞ্চি প্যাডেড ল্যাপটপ কম্পার্টমেন্ট\n• ওয়াটার রেজিস্ট্যান্ট পলিয়েস্টার ফেব্রিক\n• এক্সটার্নাল USB চার্জিং পোর্ট\n• অ্যান্টি-থেফট ব্যাক পকেট\n• ব্রিদেবল প্যাডেড স্ট্র্যাপ\n• রং: কালো, গ্রে, নেভি\n\n৬ মাসের ওয়ারেন্টি।',
    price: 1790, comparePrice: 2300, unit: 'পিস', stock: 55,
    images: ['/products/backpack.png'],
    colors: [{ name: 'কালো', hex: '#1a1a1a' }, { name: 'গ্রে', hex: '#757575' }, { name: 'নেভি', hex: '#1e3a5f' }],
    variants: combos([{ name: 'কালো', hex: '#1a1a1a' }, { name: 'গ্রে', hex: '#757575' }, { name: 'নেভি', hex: '#1e3a5f' }], null, 1790, 18),
    isFeatured: true, isBestSeller: true, rating: 4.6, reviewCount: 134, soldCount: 560,
    origin: 'Bangladesh',
  },
  {
    name: 'Aarong Leather Handbag',
    nameBn: 'আরং লেদার হ্যান্ডব্যাগ',
    slug: 'aarong-leather-handbag',
    category: 'bags-luggage', brand: 'aarong',
    shortDescription: 'জেনুইন লেদার, গোল্ডেন ক্লাস্প, স্পেসিয়াস ইনসাইড',
    description: 'আরং লেদার হ্যান্ডব্যাগ — এলিগেন্ট ডিজাইনে প্রিমিয়াম কোয়ালিটি।\n\nবৈশিষ্ট্য:\n• ১০০% জেনুইন লেদার\n• গোল্ডেন মেটাল ক্লাস্প ও ফিটিংস\n• স্পেসিয়াস মেইন কম্পার্টমেন্ট + ইনার জিপ পকেট\n• অ্যাডজাস্টেবল স্ট্র্যাপ — হ্যান্ড ও শোল্ডার দুভাবেই বহনযোগ্য\n• রং: বাদামি, কালো, লাল\n\nলেদার কন্ডিশনার ব্যবহার করে দীর্ঘস্থায়ী করুন।',
    price: 3200, comparePrice: 3900, unit: 'পিস', stock: 25,
    images: ['/products/handbag.png'],
    colors: [{ name: 'বাদামি', hex: '#5d3a1a' }, { name: 'কালো', hex: '#1a1a1a' }, { name: 'লাল', hex: '#d32f2f' }],
    variants: combos([{ name: 'বাদামি', hex: '#5d3a1a' }, { name: 'কালো', hex: '#1a1a1a' }, { name: 'লাল', hex: '#d32f2f' }], null, 3200, 8),
    isFeatured: true, rating: 4.7, reviewCount: 56, soldCount: 190,
    origin: 'Bangladesh',
  },

  // ── ঘর ও লিভিং ──
  {
    name: 'Shinepukur Ceramic Dinner Set (32 Pcs)',
    nameBn: 'শাইনপুকুর সিরামিক ডিনার সেট (৩২ পিস)',
    slug: 'shinepukur-ceramic-dinner-set-32',
    category: 'home-living', brand: 'singer',
    shortDescription: '৩২ পিস কমপ্লিট সেট, মাইক্রোওয়েভ সেফ, ব্লু ফ্লোরাল ডিজাইন',
    description: 'শাইনপুকুর সিরামিক ডিনার সেট — পরিবারের জন্য কমপ্লিট ডাইনিং সলিউশন।\n\nসেটে থাকছে:\n• ৮টি ডিনার প্লেট (১০.৫")\n• ৮টি সাইড প্লেট (৮")\n• ৮টি স্যুপ বাট\n• ৮টি কাপ ও সসার\n\nবৈশিষ্ট্য:\n• প্রিমিয়াম সিরামিক — ব্লু ফ্লোরাল প্যাটার্ন\n• মাইক্রোওয়েভ ও ডিশওয়াশার সেফ\n• লিড-ফ্রি গ্লেজ — সম্পূর্ণ নিরাপদ\n• চিপ-রেজিস্ট্যান্ট এজ\n\n১ বছরের রিপ্লেসমেন্ট গ্যারান্টি (ম্যানুফ্যাকচারিং ত্রুটিতে)।',
    price: 5490, comparePrice: 6800, unit: 'সেট', stock: 18,
    images: ['/products/dinner-set.png'],
    isFeatured: true, rating: 4.7, reviewCount: 64, soldCount: 140,
    origin: 'Bangladesh',
  },
  {
    name: 'RFL Thermo Flask 1 Litre',
    nameBn: 'RFL থার্মো ফ্লাস্ক ১ লিটার',
    slug: 'rfl-thermo-flask-1l',
    category: 'home-living', brand: 'rfl',
    shortDescription: '১২ ঘণ্টা হট/কোল্ড, স্টেইনলেস স্টিল ইনার, লিক-প্রুফ',
    description: 'RFL থার্মো ফ্লাস্ক — সারাদিন গরম ও ঠান্ডা পানীয়।\n\nবৈশিষ্ট্য:\n• ১ লিটার ক্যাপাসিটি\n• ১২ ঘণ্টা পর্যন্ত গরম/ঠান্ডা সংরক্ষণ\n• স্টেইনলেস স্টিল ইনার ওয়াল — মরিচা প্রতিরোধী\n• লিক-প্রুফ টুইস্ট ক্যাপ\n• ওয়াইড মাউথ — সহজ পরিষ্কার\n• রং: লাল, সবুজ, নীল\n\n৬ মাসের ওয়ারেন্টি।',
    price: 950, comparePrice: 1200, unit: 'পিস', stock: 80,
    images: ['/products/flask.png'],
    colors: [{ name: 'লাল', hex: '#d32f2f' }, { name: 'সবুজ', hex: '#2e7d32' }, { name: 'নীল', hex: '#1e63d0' }],
    variants: combos([{ name: 'লাল', hex: '#d32f2f' }, { name: 'সবুজ', hex: '#2e7d32' }, { name: 'নীল', hex: '#1e63d0' }], null, 950, 25),
    isBestSeller: true, rating: 4.4, reviewCount: 98, soldCount: 420,
    origin: 'Bangladesh',
  },
  {
    name: 'Relax Fleece Blanket',
    nameBn: 'রিলেক্স ফ্লিস কম্বল',
    slug: 'relax-fleece-blanket',
    category: 'home-living', brand: 'rfl',
    shortDescription: 'সুপার সফট ফ্লিস, হালকা ওজন, ৩টি সাইজ ভ্যারিয়েন্ট',
    description: 'রিলেক্স ফ্লিস কম্বল — শীতের জন্য নরম ও উষ্ণ আরাম।\n\nবৈশিষ্ট্য:\n• সুপার সফট পলিয়েস্টার ফ্লিস\n• হালকা ওজনেও চমৎকার উষ্ণতা\n• পিলিং-ফ্রি ফেব্রিক\n• সাইজ ভ্যারিয়েন্ট:\n  - সিঙ্গেল: ৯০" × ৬০"\n  - ডাবল: ৯০" × ৯০"\n  - কিং: ১০৮" × ৯০"\n• গ্রে কালার\n\nমেশিন ওয়াশেবল (জেন্টল সাইকেল)।',
    price: 1250, comparePrice: 1600, unit: 'পিস', stock: 45,
    images: ['/products/blanket.png'],
    sizes: ['সিঙ্গেল', 'ডাবল', 'কিং'],
    variants: combos(null, ['সিঙ্গেল', 'ডাবল', 'কিং'], 1250, 15, {
      '|ডাবল': { price: 1850 },
      '|কিং': { price: 2400 },
    }),
    isNew: true, rating: 4.3, reviewCount: 51, soldCount: 220,
    origin: 'Bangladesh',
  },
  {
    name: 'Cotton Bed Sheet Set (Floral)',
    nameBn: 'কটন বেডশিট সেট (ফ্লোরাল)',
    slug: 'cotton-bed-sheet-set-floral',
    category: 'home-living', brand: 'rfl',
    shortDescription: '১৪৪TC কটন, ২টি পিলও কভার সহ, ফেড-প্রুফ প্রিন্ট',
    description: 'কটন বেডশিট সেট — আরামদায়ক ঘুমের জন্য সফট কটন।\n\nসেটে থাকছে:\n• ১টি বেডশিট\n• ২টি পিলও কভার\n\nবৈশিষ্ট্য:\n• ১৪৪ থ্রেড কাউন্ট পিওর কটন\n• ফেড-প্রুফ ফ্লোরাল প্রিন্ট\n• সাইজ ভ্যারিয়েন্ট:\n  - ডাবল: ৯০" × ৯৬"\n  - কুইন: ৯৬" × ১০৮"\n• ইলাস্টিক ফিটেড এজ (কুইন সাইজে)\n\nমেশিন ওয়াশেবল।',
    price: 1450, comparePrice: 1800, unit: 'সেট', stock: 55,
    images: ['/products/bedsheet.png'],
    sizes: ['ডাবল', 'কুইন'],
    variants: combos(null, ['ডাবল', 'কুইন'], 1450, 20, {
      '|কুইন': { price: 1750 },
    }),
    rating: 4.2, reviewCount: 67, soldCount: 290,
    origin: 'Bangladesh',
  },
  {
    name: 'Ceramic Coffee Mug Set (6 Pcs)',
    nameBn: 'সিরামিক কফি মাগ সেট (৬ পিস)',
    slug: 'ceramic-coffee-mug-set-6',
    category: 'home-living', brand: 'singer',
    shortDescription: '৬টি প্যাস্টেল কালার মাগ, ২৫০ml প্রতিটি, মাইক্রোওয়েভ সেফ',
    description: 'সিরামিক কফি মাগ সেট — চা-কফি টাইমে রঙিনতা যোগ করুন।\n\nবৈশিষ্ট্য:\n• ৬টি মাগ — ৬টি ভিন্ন প্যাস্টেল কালার\n• ২৫০ml ক্যাপাসিটি প্রতিটি\n• প্রিমিয়াম সিরামিক — মাইক্রোওয়েভ ও ডিশওয়াশার সেফ\n• কমফোর্ট গ্রিপ হ্যান্ডেল\n• গিফট প্যাকেজিং সহ',
    price: 1250, comparePrice: 1500, unit: 'সেট', stock: 40,
    images: ['/products/mug-set.png'],
    isNew: true, rating: 4.5, reviewCount: 39, soldCount: 170,
    origin: 'Bangladesh',
  },

  // ── বিউটি ও পার্সোনাল কেয়ার ──
  {
    name: 'Kumarika Amla Hair Oil',
    nameBn: 'কুমারিকা আমলা হেয়ার অয়েল',
    slug: 'kumarika-amla-hair-oil',
    category: 'beauty-care', brand: 'kumarika',
    shortDescription: 'আমলা, মেহেদি ও ২৫+ ভেষজ উপাদান, ৩টি সাইজ ভ্যারিয়েন্ট',
    description: 'কুমারিকা আমলা হেয়ার অয়েল — চুলের প্রাকৃতিক যত্ন।\n\nউপাদান:\n• আমলা — ভিটামিন সি সমৃদ্ধ\n• মেহেদি — চুল মজবুত করে\n• ২৫+ ভেষজ উপাদান\n\nউপকারিতা:\n• চুল পড়া কমায়\n• চুলের গrowth বাড়ায়\n• রুক্ষ ও শুষ্ক চুল নরম করে\n• ড্যান্ড্রাফ কমায়\n\nসাইজ ভ্যারিয়েন্ট: ১০০ml, ২০০ml, ৪০০ml',
    price: 320, comparePrice: 380, unit: 'বোতল', stock: 150,
    images: ['/products/hair-oil.png'],
    sizes: ['১০০ml', '২০০ml', '৪০০ml'],
    variants: combos(null, ['১০০ml', '২০০ml', '৪০০ml'], 320, 50, {
      '|১০০ml': { price: 180 },
      '|৪০০ml': { price: 550 },
    }),
    isFeatured: true, isBestSeller: true, rating: 4.5, reviewCount: 312, soldCount: 1800,
    origin: 'Bangladesh',
  },
  {
    name: 'Tibet Herbal Face Wash',
    nameBn: 'তিবেট হারবাল ফেস ওয়াশ',
    slug: 'tibet-herbal-face-wash',
    category: 'beauty-care', brand: 'tibet',
    shortDescription: 'নিম ও মিন্ট উপাদান, অয়েল-কন্ট্রোল, সব ধরনের স্কিনের জন্য',
    description: 'তিবেট হারবাল ফেস ওয়াশ — দিনে ২ বার ব্যবহারে তাজা ত্বক।\n\nউপাদান:\n• নিম — ব্রণ প্রতিরোধী\n• মিন্ট — কুলিং ইফেক্ট\n• অ্যালোভেরা — ময়েশ্চারাইজিং\n\nউপকারিতা:\n• অতিরিক্ত তেল নিয়ন্ত্রণ করে\n• ব্রণ ও ব্ল্যাকহেডস কমায়\n• ত্বক নরম ও তাজা রাখে\n• সব ধরনের স্কিন টাইপের জন্য উপযোগী\n\n১০০ গ্রাম টিউব।',
    price: 220, comparePrice: 280, unit: 'টিউব', stock: 200,
    images: ['/products/facewash.png'],
    rating: 4.3, reviewCount: 187, soldCount: 950,
    origin: 'Bangladesh',
  },
  {
    name: 'Royal Perfume Body Spray',
    nameBn: 'রয়্যাল পারফিউম বডি স্প্রে',
    slug: 'royal-perfume-body-spray',
    category: 'beauty-care', brand: 'meril',
    shortDescription: 'লং-লাস্টিং ফ্রেগরেন্স, ২টি সাইজ ভ্যারিয়েন্ট',
    description: 'রয়্যাল পারফিউম বডি স্প্রে — সারাদিন টানা সুগন্ধ।\n\nবৈশিষ্ট্য:\n• প্রিমিয়াম ফ্রেঞ্চ ফ্রেগরেন্স অয়েল\n• ৮-১০ ঘণ্টা লং-লাস্টিং\n• উডি-ওরিয়েন্টাল নোট\n• নন-অ্যালকোহলিক ফর্মুলা (জেন্টল অন স্কিন)\n• সাইজ ভ্যারিয়েন্ট: ৫০ml, ১০০ml\n\nঅফিস, পার্টি ও ডেইলি ইউজের জন্য আদর্শ।',
    price: 450, comparePrice: 550, unit: 'বোতল', stock: 90,
    images: ['/products/perfume.png'],
    sizes: ['৫০ml', '১০০ml'],
    variants: combos(null, ['৫০ml', '১০০ml'], 450, 45, {
      '|১০০ml': { price: 750 },
    }),
    isNew: true, rating: 4.4, reviewCount: 95, soldCount: 410,
    origin: 'Bangladesh',
  },
  {
    name: 'Vitamin E Face Cream',
    nameBn: 'ভিটামিন ই ফেস ক্রিম',
    slug: 'vitamin-e-face-cream',
    category: 'beauty-care', brand: 'meril',
    shortDescription: 'ডিপ ময়েশ্চারাইজিং, গ্লো বুস্টিং, ৫০ গ্রাম জার',
    description: 'ভিটামিন ই ফেস ক্রিম — রুক্ষ ও শুষ্ক ত্বকের জন্য ডিপ নার্চারমেন্ট।\n\nউপাদান:\n• ভিটামিন ই — অ্যান্টিঅক্সিডেন্ট সুরক্ষা\n• শিয়া বাটার — ডিপ ময়েশ্চার\n• রোজ এক্সট্র্যাক্ট — ন্যাচারাল গ্লো\n\nউপকারিতা:\n• ২৪ ঘণ্টা ময়েশ্চার লক করে\n• ত্বক নরম, মসৃণ ও উজ্জ্বল করে\n• ড্রাইনেস ও ফ্লেকি স্কিন দূর করে\n\n৫০ গ্রাম জার — সব ধরনের স্কিনের জন্য।',
    price: 320, comparePrice: 390, unit: 'জার', stock: 110,
    images: ['/products/cream-jar.png'],
    rating: 4.2, reviewCount: 76, soldCount: 330,
    origin: 'Bangladesh',
  },

  // ── স্পোর্টস ও ফিটনেস ──
  {
    name: 'Lotto Football',
    nameBn: 'লোটো ফুটবল',
    slug: 'lotto-football',
    category: 'sports-fitness', brand: 'lotto',
    shortDescription: 'হাই-গ্রিপ টেক্সচার, এয়ার-লক ভাল্ব, ৩টি সাইজ ভ্যারিয়েন্ট',
    description: 'লোটো ফুটবল — ম্যাচ ও প্র্যাকটিসের জন্য টুর্নামেন্ট কোয়ালিটি।\n\nবৈশিষ্ট্য:\n• মেশি উইন্ড কনস্ট্রাকশন — শেপ রিটেনশন\n• হাই-গ্রিপ টেক্সচারড সারফেস\n• এয়ার-লক বাট ভাল্ব — দীর্ঘদিন বাতাস ধরে রাখে\n• সাইজ ভ্যারিয়েন্ট:\n  - সাইজ ৩: জুনিয়র (৮ বছরের নিচে)\n  - সাইজ ৪: ইউথ (৮-১২ বছর)\n  - সাইজ ৫: সিনিয়র / অফিসিয়াল ম্যাচ\n\nপাম্প দিয়ে ইনফ্লেট করুন (পাম্প অন্তর্ভুক্ত নয়)।',
    price: 850, comparePrice: 1100, unit: 'পিস', stock: 60,
    images: ['/products/football.png'],
    sizes: ['সাইজ ৩', 'সাইজ ৪', 'সাইজ ৫'],
    variants: combos(null, ['সাইজ ৩', 'সাইজ ৪', 'সাইজ ৫'], 850, 20, {
      '|সাইজ ৩': { price: 550 },
      '|সাইজ ৪': { price: 650 },
    }),
    isBestSeller: true, rating: 4.4, reviewCount: 83, soldCount: 350,
    origin: 'Vietnam',
  },
  {
    name: 'Premium Yoga Mat 6mm',
    nameBn: 'প্রিমিয়াম যোগা ম্যাট ৬mm',
    slug: 'premium-yoga-mat-6mm',
    category: 'sports-fitness', brand: 'lotto',
    shortDescription: 'অ্যান্টি-স্লিপ TPE ম্যাটেরিয়াল, ক্যারিং স্ট্র্যাপ সহ',
    description: 'প্রিমিয়াম যোগা ম্যাট — ঘরে বা জিমে কমফোর্টেবল ওয়ার্কআউট।\n\nবৈশিষ্ট্য:\n• ৬mm কুশনড TPE ম্যাটেরিয়াল — জয়েন্ট প্রোটেকশন\n• ডাবল-সাইডেড অ্যান্টি-স্লিপ টেক্সচার\n• ১৮৩ × ৬১ সেমি — ফুল বডি কভারেজ\n• ইকো-ফ্রেন্ডলি, নন-টক্সিক ম্যাটেরিয়াল\n• সহজে ক্লিনেবল, সোয়েট-রেজিস্ট্যান্ট\n• ক্যারিং স্ট্র্যাপ সহ\n• রং: পার্পল, নীল, সবুজ',
    price: 990, comparePrice: 1300, unit: 'পিস', stock: 45,
    images: ['/products/yoga-mat.png'],
    colors: [
      { name: 'পার্পল', hex: '#7b1fa2' },
      { name: 'নীল', hex: '#1e63d0' },
      { name: 'সবুজ', hex: '#2e7d32' },
    ],
    variants: combos([{ name: 'পার্পল', hex: '#7b1fa2' }, { name: 'নীল', hex: '#1e63d0' }, { name: 'সবুজ', hex: '#2e7d32' }], null, 990, 15),
    isNew: true, rating: 4.6, reviewCount: 44, soldCount: 180,
    origin: 'China',
  },
  {
    name: 'Rubber Coated Dumbbell Set (10kg)',
    nameBn: 'রাবার কোটেড ডাম্বেল সেট (১০ কেজি)',
    slug: 'rubber-coated-dumbbell-set-10kg',
    category: 'sports-fitness', brand: 'lotto',
    shortDescription: '২ × ৫ কেজি, রাবার কোটেড প্লেট, ক্রোম হ্যান্ডেল',
    description: 'রাবার কোটেড ডাম্বেল সেট — হোম জিমের জন্য পারফেক্ট স্টার্টার সেট।\n\nসেটে থাকছে:\n• ২টি ৫ কেজি রাবার কোটেড প্লেট\n• ২টি ক্রোম ফিনিশ হ্যান্ডেল বার\n• লক কলার (স্টার টাইপ)\n\nবৈশিষ্ট্য:\n• রাবার কোটেড প্লেট — ফ্লোর প্রোটেকশন ও নয়েজ-ফ্রি\n• নন-স্লিপ ক্রোম হ্যান্ডেল গ্রিপ\n• মরিচা-প্রতিরোধী ফিনিশ\n• বাইসেপ, ট্রাইসেপ, শোল্ডার ও ফুল বডি ওয়ার্কআউটের জন্য',
    price: 2400, comparePrice: 2900, unit: 'সেট', stock: 25,
    images: ['/products/dumbbell.png'],
    rating: 4.5, reviewCount: 58, soldCount: 210,
    origin: 'China',
  },

  // ── বেবি ও টয়েজ ──
  {
    name: 'Baby Romper Pack of 3',
    nameBn: 'বেবি রম্পার প্যাক অব ৩',
    slug: 'baby-romper-pack-3',
    category: 'baby-toys', brand: 'aarong',
    shortDescription: '১০০% কটন, স্ন্যাপ ক্লোজার, ৩টি রং কম্বিনেশন',
    description: 'বেবি রম্পার প্যাক অব ৩ — আপনার ছোট্ট সোনামণির আরামের জন্য।\n\nবৈশিষ্ট্য:\n• ১০০% সফট অর্গানিক কটন — সংবেদনশীল স্কিনের জন্য নিরাপদ\n• সহজ স্ন্যাপ ক্লোজার — ডায়াপার চেঞ্জিং সহজ\n• ব্রিদেবল ফেব্রিক — ত্বক ঠান্ডা থাকে\n• মেশিন ওয়াশেবল, কালার-লক ডাই\n• রং: হলুদ, গোলাপি, আকাশি (প্রতিটি প্যাকে ৩টি করে নির্বাচিত রং)\n• এজ গ্রুপ ভ্যারিয়েন্ট: ০-৬ মাস, ৬-১২ মাস, ১২-২৪ মাস',
    price: 850, comparePrice: 1100, unit: 'প্যাক', stock: 50,
    images: ['/products/baby-romper.png'],
    colors: [
      { name: 'হলুদ', hex: '#f9a825' },
      { name: 'গোলাপি', hex: '#f48fb1' },
      { name: 'আকাশি', hex: '#81d4fa' },
    ],
    sizes: ['০-৬ মাস', '৬-১২ মাস', '১২-২৪ মাস'],
    variants: combos([{ name: 'হলুদ', hex: '#f9a825' }, { name: 'গোলাপি', hex: '#f48fb1' }, { name: 'আকাশি', hex: '#81d4fa' }], ['০-৬ মাস', '৬-১২ মাস', '১২-২৪ মাস'], 850, 5),
    isFeatured: true, rating: 4.7, reviewCount: 67, soldCount: 290,
    origin: 'Bangladesh',
  },
  {
    name: 'Giant Teddy Bear',
    nameBn: 'জায়ান্ট টেডি বিয়ার',
    slug: 'giant-teddy-bear',
    category: 'baby-toys', brand: 'toy-land',
    shortDescription: 'সুপার সফট প্লাশ, হাগি ফ্রেন্ডলি, ২ ফুট / ৩ ফুট',
    description: 'জায়ান্ট টেডি বিয়ার — আপনার সোনামণির সেরা বন্ধু।\n\nবৈশিষ্ট্য:\n• সুপার সফট প্রিমিয়াম প্লাশ ফেব্রিক\n• নন-টক্সিক স্টাফিং — বাচ্চাদের জন্য নিরাপদ\n• সেলাই-প্রুফ আইজ (চোখ ঝুলে পড়বে না)\n• সাইজ ভ্যারিয়েন্ট: ২ ফুট, ৩ ফুট\n• বাদামি কালার\n• জন্মদিন ও ভ্যালেন্টাইন গিফটের জন্য পারফেক্ট\n\nসারফেস ওয়াশেবল।',
    price: 950, comparePrice: 1300, unit: 'পিস', stock: 30,
    images: ['/products/teddy-bear.png'],
    sizes: ['২ ফুট', '৩ ফুট'],
    variants: combos(null, ['২ ফুট', '৩ ফুট'], 950, 12, {
      '|৩ ফুট': { price: 1500 },
    }),
    isBestSeller: true, rating: 4.8, reviewCount: 94, soldCount: 380,
    origin: 'China',
  },
  {
    name: 'Colorful Building Blocks (200+ Pcs)',
    nameBn: 'কালারফুল বিল্ডিং ব্লকস (২০০+ পিস)',
    slug: 'colorful-building-blocks-200',
    category: 'baby-toys', brand: 'toy-land',
    shortDescription: '২০০+ পিস, BPA-ফ্রি ABS প্লাস্টিক, ক্রিয়েটিভিটি বিল্ডার',
    description: 'কালারফুল বিল্ডিং ব্লকস — শিশুর কল্পনাশক্তি বিকাশের সেরা খেলনা।\n\nবৈশিষ্ট্য:\n• ২০০+ পিস ভ্যারাইটি ব্লক\n• BPA-ফ্রি, নন-টক্সিক ABS প্লাস্টিক\n• স্মুথ এজ — হাত কাটবে না\n• ৮টি উজ্জ্বল রং\n• স্টোরেজ বক্স সহ\n• ৩+ বছর বয়সের জন্য উপযুক্ত\n\nSTEM লার্নিং, হ্যান্ড-আই কোঅর্ডিনেশন ও ক্রিয়েটিভিটি বাড়ায়।',
    price: 1250, comparePrice: 1600, unit: 'সেট', stock: 40,
    images: ['/products/building-blocks.png'],
    isNew: true, rating: 4.6, reviewCount: 71, soldCount: 260,
    origin: 'China',
  },

  // ── বই ও স্টেশনারি ──
  {
    name: 'English Vocabulary Master Guide',
    nameBn: 'ইংলিশ ভোকাবুলারি মাস্টার গাইড',
    slug: 'english-vocabulary-master-guide',
    category: 'books-stationery', brand: null,
    shortDescription: '৫০০০+ শব্দ, উচ্চারণ গাইড, BCS ও IELTS প্রস্তুতির জন্য',
    description: 'ইংলিশ ভোকাবুলারি মাস্টার গাইড — ইংরেজি শেখার সম্পূর্ণ সমাধান।\n\nবইটিতে থাকছে:\n• ৫০০০+ দৈনন্দিন ও অ্যাকাডেমিক শব্দ\n• বাংলা অর্থ ও বাংলা উচ্চারণ গাইড\n• উদাহরণসহ বাক্য গঠন\n• সিনোনিম-অ্যান্টোনিম লিস্ট\n• প্র্যাকটিস এক্সারসাইজ প্রতি চ্যাপ্টারে\n• BCS, IELTS, ভার্সিটি অ্যাডমিশন প্রস্তুতির জন্য বিশেষ টিপস\n\n৪০০+ পেজ, সফট কভার, সাম্প্রতিকতম সংস্করণ।',
    price: 380, comparePrice: 450, unit: 'পিস', stock: 100,
    images: ['/products/notebook.png'],
    rating: 4.5, reviewCount: 128, soldCount: 540,
    origin: 'Bangladesh',
  },
  {
    name: 'Matador Notebook Pack of 10',
    nameBn: 'ম্যাটাডোর খাতা প্যাক (১০টি)',
    slug: 'matador-notebook-pack-10',
    category: 'books-stationery', brand: 'matador',
    shortDescription: '১০টি খাতা, সুপার স্মুথ পেজ, ২ সাইজ ভ্যারিয়েন্ট',
    description: 'ম্যাটাডোর খাতা প্যাক — স্কুল ও কলেজের জন্য বেস্ট ভ্যালু।\n\nবৈশিষ্ট্য:\n• প্যাকে ১০টি খাতা\n• সুপার স্মুথ ৭০ GSM পেপার — কলম আটকায় না\n• স্টিচড বাইন্ডিং — পেজ উঠে আসবে না\n• আকর্ষণীয় কভার ডিজাইন\n• সাইজ ভ্যারিয়েন্ট: ১০০ পেজ, ২০০ পেজ\n\nস্কুল সেশনের শুরুতে বাল্ক কেনার জন্য পারফেক্ট।',
    price: 320, comparePrice: 400, unit: 'প্যাক', stock: 80,
    images: ['/products/notebook.png'],
    sizes: ['১০০ পেজ', '২০০ পেজ'],
    variants: combos(null, ['১০০ পেজ', '২০০ পেজ'], 320, 40, {
      '|২০০ পেজ': { price: 450 },
    }),
    isBestSeller: true, rating: 4.4, reviewCount: 152, soldCount: 680,
    origin: 'Bangladesh',
  },
  {
    name: 'Premium Ballpoint Pen Set (12 Pcs)',
    nameBn: 'প্রিমিয়াম বলপয়েন্ট পেন সেট (১২টি)',
    slug: 'premium-ballpoint-pen-set-12',
    category: 'books-stationery', brand: 'matador',
    shortDescription: '০.৭mm স্মুথ রাইটিং, ব্লু/ব্ল্যাক/রেড কম্বিনেশন, গিফট বক্স',
    description: 'প্রিমিয়াম বলপয়েন্ট পেন সেট — অফিস ও স্টাডিতে স্মুথ রাইটিং।\n\nবৈশিষ্ট্য:\n• ১২টি পেন — ৪টি ব্লু, ৪টি ব্ল্যাক, ৪টি রেড\n• ০.৭mm টিপ — কনসিস্টেন্ট ইঙ্ক ফ্লো\n• রাবার গ্রিপ — দীর্ঘ লেখাতেও হাত ব্যথা হয় না\n• রিফিলেবল ডিজাইন\n• অ্যাট্রাকটিভ গিফট বক্স প্যাকেজিং\n\nগিফট হিসেবেও দারুণ পছন্দ।',
    price: 180, comparePrice: 240, unit: 'সেট', stock: 150,
    images: ['/products/pen-set.png'],
    isNew: true, rating: 4.3, reviewCount: 89, soldCount: 470,
    origin: 'Bangladesh',
  },

  // ── গ্রোসারি ──
  {
    name: 'Pran Mango Juice',
    nameBn: 'প্রাণ ম্যাংগো জুস',
    slug: 'pran-mango-juice',
    category: 'grocery', brand: 'pran',
    shortDescription: 'আসল ম্যাংগো পাল্প, ভিটামিন সি সমৃদ্ধ, ৩টি সাইজ ভ্যারিয়েন্ট',
    description: 'প্রাণ ম্যাংগো জুস — পাকা রাজশাহীর আমের আসল স্বাদ।\n\nবৈশিষ্ট্য:\n• আসল ম্যাংগো পাল্প থেকে তৈরি\n• ভিটামিন সি ও অ্যান্টিঅক্সিডেন্ট সমৃদ্ধ\n• প্রিজারভেটিভ-ফ্রি ফর্মুলা\n• সাইজ ভ্যারিয়েন্ট: ২৫০ml, ৫০০ml, ১ লিটার\n• টেট্রা প্যাক — বাইরে বহনযোগ্য\n\nমার্জিত স্বাদ, সম্পূর্ণ হালাল ও BSTI অনুমোদিত।',
    price: 110, comparePrice: 130, unit: 'প্যাক', stock: 300,
    images: ['/products/mango-juice.png'],
    sizes: ['২৫০ml', '৫০০ml', '১ লিটার'],
    variants: combos(null, ['২৫০ml', '৫০০ml', '১ লিটার'], 110, 100, {
      '|২৫০ml': { price: 35 },
      '|৫০০ml': { price: 60 },
    }),
    isBestSeller: true, rating: 4.4, reviewCount: 214, soldCount: 1500,
    origin: 'Bangladesh',
  },
  {
    name: 'Fresh Soyabean Oil 5 Litre',
    nameBn: 'ফ্রেশ সয়াবিন তেল ৫ লিটার',
    slug: 'fresh-soyabean-oil-5l',
    category: 'grocery', brand: 'fresh',
    shortDescription: '১০০% পিওর সয়াবিন তেল, ভিটামিন A ফোর্টিফাইড, জার প্যাক',
    description: 'ফ্রেশ সয়াবিন তেল — বাংলাদেশের #১ রান্নার তেল।\n\nবৈশিষ্ট্য:\n• ১০০% পিওর রিফাইন্ড সয়াবিন তেল\n• ভিটামিন A ফোর্টিফাইড\n• কোলেস্টেরল-ফ্রি\n• ৫ লিটার জার প্যাক — পরিবারের জন্য সাশ্রয়ী\n• লিক-প্রুফ সিল\n\nBSTI অনুমোদিত। ঠান্ডা ও অন্ধকার জায়গায় সংরক্ষণ করুন।',
    price: 850, comparePrice: 950, unit: 'জার', stock: 120,
    images: ['/products/soyabean-oil.png'],
    isFeatured: true, rating: 4.5, reviewCount: 176, soldCount: 980,
    origin: 'Bangladesh',
  },
]

// ────────────────────── Homepage content (admin-managed) ──────────────────────
const featuresSeed = [
  { icon: 'bi-shop-window', title: '২১+ বিখ্যাত ব্র্যান্ড', desc: 'Samsung, Xiaomi, Aarong, Sailor, Bata সহ দেশ-বিদেশের সেরা ব্র্যান্ডগুলো একসাথে।', highlighted: true, sortOrder: 1 },
  { icon: 'bi-patch-check-fill', title: '১০০% অরিজিনাল পণ্য', desc: 'প্রতিটি পণ্য সরাসরি ব্র্যান্ড বা অথরাইজড ডিস্ট্রিবিউটরের কাছ থেকে সংগ্রহ করা।', sortOrder: 2 },
  { icon: 'bi-truck', title: 'দ্রুত ডেলিভারি', desc: 'ঢাকায় ২৪ ঘন্টা, ঢাকার বাইরে ৪৮-৭২ ঘন্টায় পণ্য পৌঁছে যায়।', sortOrder: 3 },
  { icon: 'bi-shield-check', title: 'নিরাপদ পেমেন্ট', desc: 'ক্যাশ অন ডেলিভারি, বিকাশ, নগদ, রকেট ও ক্রেডিট/ডেবিট কার্ড সাপোর্ট।', sortOrder: 4 },
]

const testimonialsSeed = [
  { name: 'শারমিন আক্তার', area: 'মিরপুর, ঢাকা', text: 'আরং সালোয়ার কামিজ অর্ডার করেছিলাম। রং আর সাইজ নিজে বেছে নেওয়ার সুবিধাটা দারুণ লেগেছে। প্যাকেজিংও খুব সুন্দর।', rating: 5, highlighted: true, sortOrder: 1 },
  { name: 'আরিফুল ইসলাম', area: 'চট্টগ্রাম', text: 'Havit-এর ইয়ারবাডস নিয়েছি, অরিজিনাল পণ্য। দামও মার্কেটের তুলনায় কম। দ্রুত ডেলিভারি পেয়েছি।', rating: 5, sortOrder: 2 },
  { name: 'দিলরুবা খানম', area: 'উত্তরা, ঢাকা', text: 'ডিনার সেট আর বেডশিট একসাথে অর্ডার করেছি। কোয়ালিটি প্রিমিয়াম, দাম রিজনেবল। পরিবারের সবাই খুশি।', rating: 4, sortOrder: 3 },
  { name: 'মাহমুদ হাসান', area: 'সিলেট', text: 'ক্যাশ অন ডেলিভারি সুবিধাটা অনেক ভরসা দেয়। পণ্য হাতে পেয়ে চেক করে তারপর টাকা দিয়েছি।', rating: 5, sortOrder: 4 },
]

// ───────────────────────────── পার্ক বক্স (পণ্য পেজ ট্রাস্ট ব্যাজ) ─────────────────────────────
const productPerksSeed = [
  { icon: 'bi-truck', title: 'দ্রুত ডেলিভারি', subtitle: '২৪-৭২ ঘন্টায়', sortOrder: 1 },
  { icon: 'bi-shield-check', title: '১০০% অরিজিনাল', subtitle: 'নিশ্চয়তা', sortOrder: 2 },
  { icon: 'bi-arrow-counterclockwise', title: 'সহজ রিটার্ন', subtitle: '১২ ঘন্টায়', sortOrder: 3 },
]

// ───────────────────────────── Reviews ─────────────────────────────
const reviewsBySlug: Record<string, { name: string; rating: number; comment: string }[]> = {
  'havit-tw927-tws-earbuds': [
    { name: 'তানভীর আহমেদ', rating: 5, comment: 'এই দামে সাউন্ড কোয়ালিটি অবিশ্বাস্য! বেস খুব ভালো, ব্যাটারিও ভালো দেয়।' },
    { name: 'সাদিয়া ইসলাম', rating: 4, comment: 'কলিং এ ভয়েস ক্লিয়ার আসে। সাদা কালারটা সুন্দর হয়েছে।' },
  ],
  'symphony-g22-smartphone': [
    { name: 'রাকিব হাসান', rating: 4, comment: 'দাম অনুযায়ী দারুণ ফোন। ১২৮GB ভ্যারিয়েন্ট নিয়েছি, স্পেস যথেষ্ট।' },
  ],
  'haylou-smart-watch-rs1': [
    { name: 'নুসরাত জাহান', rating: 5, comment: 'হার্ট রেট ও স্লিপ ট্র্যাকিং কাজ করে সঠিকভাবে। ব্যাটারি ১০ দিন চলে।' },
    { name: 'মেহেদী হাসান', rating: 4, comment: 'ডিসপ্লে সুন্দর, কিন্তু স্ট্র্যাপ আরেকটু নরম হলে ভালো হতো।' },
  ],
  'sailor-premium-cotton-panjabi': [
    { name: 'আব্দুল্লাহ আল মামুন', rating: 5, comment: 'কাপড়ের কোয়ালিটি একদম প্রিমিয়াম। ঈদের জন্য ২টা নিয়েছি।' },
    { name: 'শাহরিয়ার কবির', rating: 4, comment: '৪২ সাইজ পারফেক্ট ফিট হয়েছে। এমব্রয়ডারি সুন্দর।' },
  ],
  'aarong-block-print-salwar-kameez': [
    { name: 'ফারজানা রহমান', rating: 5, comment: 'ব্লক প্রিন্টটা হাতে বানানো মনে হয়। ডুপাটাসহ সেট দামের তুলনায় দুর্দান্ত।' },
  ],
  'bata-sports-sneakers': [
    { name: 'ইমরান খান', rating: 5, comment: 'খুব আরাম, দৌড়াতে পায়ে ব্যথা হয় না। বাটার কোয়ালিটি আসলেই ভরসার।' },
  ],
  'vision-laptop-backpack-30l': [
    { name: 'তাসনিম আক্তার', rating: 4, comment: 'ল্যাপটপ কম্পার্টমেন্ট খুব ভালো। USB পোর্টে পাওয়ার ব্যাংক লাগিয়ে চার্জ দিতে পারি।' },
  ],
  'kumarika-amla-hair-oil': [
    { name: 'সুমাইয়া হক', rating: 5, comment: 'নিয়মিত ব্যবহারে চুল পড়া অনেক কমেছে। ৪০০ml সাইজটা সাশ্রয়ী।' },
  ],
  'giant-teddy-bear': [
    { name: 'মিতু চৌধুরী', rating: 5, comment: 'মেয়ের জন্মদিনে দিয়েছি, ৩ ফুটেরটা ছবির মতোই বড় ও নরম!' },
  ],
  'fresh-soyabean-oil-5l': [
    { name: 'আফসানা মিমি', rating: 4, comment: 'মূল প্যাকেট, দামও মার্কেটের চেয়ে ভালো। হোম ডেলিভারিতে ঘরে এসে পেয়েছি।' },
  ],
};

// ───────────────────────────── ডিফল্ট সেটিংস ─────────────────────────────
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  // আইডেন্টিটি
  site_title: 'THE SHOP BD',
  site_tagline: 'মাল্টিব্র্যান্ড অনলাইন শপিং',
  site_logo: '',
  site_favicon: '',
  site_description: 'THE SHOP BD — বাংলাদেশের বিশ্বস্ত মাল্টিব্র্যান্ড অনলাইন শপ। ইলেকট্রনিকস, ফ্যাশন, হোম ও লিভিং, বিউটিসহ ২১+ বিখ্যাত ব্র্যান্ডের অরিজিনাল পণ্য সারাদেশে হোম ডেলিভারি।',

  // যোগাযোগ
  contact_phone: '+৮৮০৯৬৪২-৯২২৯২২',
  contact_email: 'support@theshopbd.com',
  contact_address: 'রামপুরা, ঢাকা-১২১৯, বাংলাদেশ',
  support_hours: 'প্রতিদিন সকাল ৯টা - রাত ১০টা',

  // সোশ্যাল
  social_facebook: 'https://facebook.com/theshopbd',
  social_youtube: '',
  social_instagram: 'https://instagram.com/theshopbd',
  social_whatsapp: 'https://wa.me/8809642922922',
  social_messenger: '',

  // ফুটার
  footer_text: 'ভালোবাসা দিয়ে তৈরি — ঢাকা, বাংলাদেশে',
  footer_about: 'THE SHOP BD — বাংলাদেশের বিশ্বস্ত মাল্টিব্র্যান্ড অনলাইন শপ। অরিজিনাল পণ্য, সেরা দাম ও দ্রুত হোম ডেলিভারি।',
  footer_cod_text: 'Cash on delivery all over Bangladesh',

  // হোমপেজ সেকশন
  section_brands: '1',
  section_why: '1',
  section_testimonials: '1',
  section_payment: '1',
  section_categories: '1',
  section_recently_viewed: '1',

  // পণ্য পেজ পার্ক বক্স (ট্রাস্ট ব্যাজ)
  pd_perks_enabled: '1',

  // ঘোষণা বার (স্লাইডিং লেখাগুলোর মাস্টার সুইচ)
  announcement_enabled: '1',

  // পপআপ নোটিশ
  popup_notice_enabled: '0',
  popup_notice_type: 'text',
  popup_notice_title: 'নোটিশ',
  popup_notice_message: '',
  popup_notice_image: '',
  popup_notice_button_text: 'ঠিক আছে',
  popup_notice_link: '',

  // পপআপ অফার
  popup_offer_enabled: '0',
  popup_offer_type: 'text',
  popup_offer_title: 'বিশেষ অফার',
  popup_offer_message: '',
  popup_offer_image: '',
  popup_offer_button_text: 'অফার দেখুন',
  popup_offer_link: '',

  // লোকালাইজেশন
  default_language: 'bn',
  currency_code: 'BDT',
  currency_symbol: '৳',
  timezone: 'Asia/Dhaka',
  date_format: 'DD MMM YYYY',

  // ট্যাক্স ও প্রাইসিং
  tax_enabled: '0',
  tax_percent: '0',
  tax_inclusive: '1',
  min_order_amount: '0',
  free_shipping_threshold: '2000',

  // ইনভয়েস
  invoice_note: 'পণ্য গ্রহণের ৭ দিনের মধ্যে সমস্যা জানালে রিটার্ন/রিপ্লেসমেন্ট প্রযোজ্য।',

  // নোটিফিকেশন (ভবিষ্যৎ ইন্টিগ্রেশনের ভিত্তি)
  notif_order_enabled: '1',
  notif_promo_enabled: '1',
  notif_stock_enabled: '1',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_sender_email: '',

  // SEO
  seo_title: 'THE SHOP BD — মাল্টিব্র্যান্ড অনলাইন শপিং',
  seo_description: 'THE SHOP BD — বাংলাদেশের সেরা মাল্টিব্র্যান্ড অনলাইন শপ। ২১+ বিখ্যাত ব্র্যান্ডের অরিজিনাল পণ্য ঘরে বসেই অর্ডার করুন।',
  seo_keywords: 'THE SHOP BD, theshopbd, অনলাইন শপিং বাংলাদেশ, মাল্টিব্র্যান্ড শপ, ইলেকট্রনিকস, ফ্যাশন',
  seo_og_image: '',
  seo_google_verification: '',
  seo_analytics_id: '',

  // নিরাপত্তা
  security_session_timeout: '1440',
  security_max_login_attempts: '5',
  security_maintenance_mode: '0',
  security_maintenance_message: 'আমরা সাময়িক রক্ষণাবেক্ষণে আছি। খুব শীঘ্রই ফিরে আসবো!',

  // সিস্টেম
  system_version: '1.0.0',

  // GitHub হোস্টিং (ছবি/ভিডিও আপলোড — GitHub repo API, jsDelivr CDN দিয়ে লোড)
  github_owner: '',
  github_repo: '',
  github_branch: 'main',
  github_folder: 'uploads',
  github_token: '',

  // ── WhatsApp অর্ডার বাটন ও ফ্লোটিং চ্যাট ──
  wa_enabled: '0',
  wa_phone: '',
  wa_message_template: 'আসসালামু আলাইকুম! আমি {site}-এ অর্ডার করতে চাই।',
  wa_float_enabled: '1',
  wa_float_position: 'right',
  wa_product_button: '1',

  // ── অ্যানালিটিক্স (GA4 + Facebook Pixel) ──
  ga4_enabled: '0',
  ga4_id: '',
  fb_pixel_enabled: '0',
  fb_pixel_id: '',

  // ── পুশ নোটিফিকেশন (FCM) ──
  push_enabled: '0',
  push_vapid_key: '',

  // ── SMS ──
  sms_enabled: '0',
  sms_provider_type: 'bulksmsbd',
  sms_api_url: 'https://bulksmsbd.net/api/apiSend_sms/sendingapi',
  sms_api_key: '',
  sms_sender_id: '',
  sms_store_id: '',
  sms_store_password: '',
  sms_custom_method: 'POST',
  sms_custom_body: 'api_key={apikey}&type=text&number={to}&senderid={sender}&message={message}',
  sms_tpl_order: '{name}, আপনার অর্ডার {order} গৃহীত হয়েছে। মোট: {total} টাকা। - {site}',
  sms_tpl_status: '{name}, আপনার অর্ডার {order} এখন "{status}"। - {site}',
  sms_tpl_abandoned: 'আপনার কার্টে {count} টি পণ্য অপেক্ষা করছে! এখনই অর্ডার সম্পূর্ণ করুন {site} {offer}',
  sms_admin_phone: '',

  // ── Steadfast কুরিয়ার ──
  sf_enabled: '0',
  sf_api_url: 'https://portal.steadfast.com.bd/api/v1',
  sf_api_key: '',
  sf_secret_key: '',
  sf_send_cod: '1',

  // ── bKash Tokenized Checkout ──
  bkash_enabled: '0',
  bkash_mode: 'sandbox',
  bkash_username: '',
  bkash_password: '',
  bkash_app_key: '',
  bkash_app_secret: '',

  // ── SSLCommerz ──
  sslcz_enabled: '0',
  sslcz_mode: 'sandbox',
  sslcz_store_id: '',
  sslcz_store_passwd: '',
  sslcz_currency: 'BDT',

  // ── ওয়েবহুক সিক্রেট ──
  webhook_secret: 'tsb-hook-change-me',

  // ── লয়ালটি পয়েন্ট ──
  loyalty_enabled: '0',
  loyalty_earn_rate: '1',
  loyalty_point_value: '1',
  loyalty_min_redeem: '50',
  loyalty_max_percent: '50',

  // ── রেফারেল কমিশন ──
  referral_enabled: '0',
  referral_percent: '5',
  referral_first_only: '1',
  referral_min_withdraw: '500',

  // ── অ্যাব্যান্ডন্ড কার্ট রিমাইন্ডার ──
  ac_enabled: '0',
  ac_threshold: '60',
  ac_offer_text: '',
};

// ───────────────────────────── স্লাইডিং ঘোষণা বার (হেডারের উপরে) ─────────────────────────────
const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  { id: 'ann_1', icon: 'bi-truck', text: 'ঢাকার ভিতরে ৳২০০০+ অর্ডারে ফ্রি ডেলিভারি!', link: null, enabled: true, sortOrder: 1 },
  { id: 'ann_2', icon: 'bi-patch-check-fill', text: '১০০% অরিজিনাল ব্র্যান্ডেড পণ্যের নিশ্চয়তা', link: null, enabled: true, sortOrder: 2 },
  { id: 'ann_3', icon: 'bi-gift', text: 'কুপন কোড "SHOP10" দিয়ে ১০% ছাড় পান', link: '/shop?offers=1', enabled: true, sortOrder: 3 },
  { id: 'ann_4', icon: 'bi-telephone-fill', text: 'হটলাইন: 09642-922922', link: null, enabled: true, sortOrder: 4 },
  { id: 'ann_5', icon: 'bi-credit-card-fill', text: 'ক্যাশ অন ডেলিভারি, বিকাশ, নগদ ও কার্ড পেমেন্ট', link: null, enabled: true, sortOrder: 5 },
  { id: 'ann_6', icon: 'bi-shop', text: '২১+ বিখ্যাত ব্র্যান্ড — সব এক অ্যাপে!', link: null, enabled: true, sortOrder: 6 },
];

// ───────────────────────────── হিরো স্লাইড ও সাইড ব্যানার ─────────────────────────────
const DEFAULT_SLIDES: Slide[] = [
  {
    id: 'slide_1', theme: 0, store: 'THE SHOP BD',
    title: 'সামার স্মার্টফোন\nমেগা ডিল',
    tagline: 'Samsung • Xiaomi • Walton • Symphony — অরিজিনাল ওয়ারেন্টি সহ',
    priceFrom: 8990, discount: '-৩৫%', cta: 'এখনই কিনুন',
    photos: ['/products/smartphone.png', '/products/earbuds.png', '/products/smartwatch.png'],
    action: { name: 'shop', category: 'mobile-tablet' },
    active: true, sortOrder: 1,
  },
  {
    id: 'slide_2', theme: 1, store: 'THE SHOP BD',
    title: 'গ্যাজেট\nফেস্ট চলছে',
    tagline: 'ইয়ারবাডস • স্মার্ট ওয়াচ • স্পিকার — ৫০% পর্যন্ত ছাড়',
    priceFrom: 990, discount: '-৫০%', cta: 'অফার দেখুন',
    photos: ['/products/speaker.png', '/products/earbuds.png', '/products/smartwatch.png'],
    action: { name: 'shop', category: 'audio-sound' },
    active: true, sortOrder: 2,
  },
  {
    id: 'slide_3', theme: 2, store: 'THE SHOP BD',
    title: 'নতুন ফ্যাশন\nনতুন স্টাইল',
    tagline: 'Aarong • Sailor • Ecstasy — ঈদ কালেকশন এসে গেছে',
    priceFrom: 1290, discount: '-২৫%', cta: 'কালেকশন দেখুন',
    photos: ['/products/panjabi.png', '/products/salwar-kameez.png', '/products/sneakers.png'],
    action: { name: 'shop', category: 'fashion' },
    active: true, sortOrder: 3,
  },
  {
    id: 'slide_4', theme: 3, store: 'THE SHOP BD',
    title: 'ফ্রি ডেলিভারি\n৳২০০০+ অর্ডারে',
    tagline: 'সারাদেশে ক্যাশ অন ডেলিভারি — ভরসায় THE SHOP BD',
    priceFrom: null, discount: 'ফ্রি', cta: 'শপিং শুরু করুন',
    photos: ['/products/backpack.png', '/products/dinner-set.png', '/products/soyabean-oil.png'],
    action: { name: 'offers' },
    active: true, sortOrder: 4,
  },
];

const DEFAULT_SIDE_BANNERS: SideBanner[] = [
  {
    id: 'side_1', theme: 1, title: 'ফ্যাশন ফেস্ট',
    tagline: 'সেরা কালেকশন', subtitle: '৫০% পর্যন্ত ছাড়',
    photo: '/products/salwar-kameez.png',
    action: { name: 'shop', category: 'fashion' },
    active: true, sortOrder: 1,
  },
  {
    id: 'side_2', theme: 0, title: 'স্পেশাল অফার',
    tagline: 'গ্যাজেট ও ইলেকট্রনিকস', subtitle: '৳৯৯০ থেকে শুরু',
    photo: '/products/earbuds.png',
    action: { name: 'offers' },
    active: true, sortOrder: 2,
  },
];

// ───────────────────────────── ডেলিভারি জোন ও কুরিয়ার ─────────────────────────────
const DEFAULT_DELIVERY_ZONES: DeliveryZone[] = [
  { id: 'zone_dhaka', name: 'ঢাকা সিটি', districts: ['ঢাকা'], charge: 60, eta: '২৪-৪৮ ঘণ্টা', freeShippingOver: 2000, codAvailable: true, active: true, sortOrder: 1 },
  { id: 'zone_dhaka_sub', name: 'ঢাকা উপশহর', districts: ['ঢাকা (সাভার, কেরানীগঞ্জ, নবাবগঞ্জ)', 'গাজীপুর', 'নারায়ণগঞ্জ'], charge: 80, eta: '৪৮-৭২ ঘণ্টা', freeShippingOver: 2500, codAvailable: true, active: true, sortOrder: 2 },
  { id: 'zone_outside', name: 'ঢাকার বাইরে', districts: ['সকল জেলা'], charge: 120, eta: '৪৮-৭২ ঘণ্টা', freeShippingOver: 3000, codAvailable: true, active: true, sortOrder: 3 },
];

const DEFAULT_COURIERS: Courier[] = [
  { id: 'courier_steadfast', name: 'Steadfast', nameBn: 'স্টেডফাস্ট', trackingUrl: 'https://steadfast.com.bd/t/{tracking}', apiKey: '', apiSecret: '', active: true, sortOrder: 1 },
  { id: 'courier_pathao', name: 'Pathao Courier', nameBn: 'পাঠাও কুরিয়ার', trackingUrl: 'https://pathao.com/track/{tracking}', apiKey: '', apiSecret: '', active: true, sortOrder: 2 },
  { id: 'courier_redx', name: 'REDX', nameBn: 'রেডএক্স', trackingUrl: 'https://redx.com.bd/track/{tracking}', apiKey: '', apiSecret: '', active: true, sortOrder: 3 },
  { id: 'courier_own', name: 'Own Delivery', nameBn: 'নিজস্ব ডেলিভারি', trackingUrl: '', apiKey: '', apiSecret: '', active: true, sortOrder: 4 },
];

// ───────────────────────────── কুপন ─────────────────────────────
const DEFAULT_COUPONS: Coupon[] = [
  { id: 'cpn_shop10', code: 'SHOP10', type: 'percent', value: 10, minOrder: 500, maxDiscount: 300, expiresAt: null, usageLimit: null, usedCount: 0, perUserLimit: null, categoryIds: null, productIds: null, brandIds: null, firstOrderOnly: false, active: true, createdAt: new Date().toISOString() },
  { id: 'cpn_welcome50', code: 'WELCOME50', type: 'fixed', value: 50, minOrder: 300, maxDiscount: null, expiresAt: null, usageLimit: null, usedCount: 0, perUserLimit: 1, categoryIds: null, productIds: null, brandIds: null, firstOrderOnly: false, active: true, createdAt: new Date().toISOString() },
  { id: 'cpn_save100', code: 'SAVE100', type: 'fixed', value: 100, minOrder: 1500, maxDiscount: null, expiresAt: null, usageLimit: null, usedCount: 0, perUserLimit: null, categoryIds: null, productIds: null, brandIds: null, firstOrderOnly: false, active: true, createdAt: new Date().toISOString() },
  { id: 'cpn_new20', code: 'NEW20', type: 'percent', value: 20, minOrder: 2000, maxDiscount: 500, expiresAt: null, usageLimit: null, usedCount: 0, perUserLimit: 1, categoryIds: null, productIds: null, brandIds: null, firstOrderOnly: true, active: true, createdAt: new Date().toISOString() },
];

// ───────────────────────────── রোল ও ডিফল্ট ইউজার ─────────────────────────────
const ALL_PERMISSIONS = [...PERMISSIONS];

const DEFAULT_ROLES: Role[] = [
  { id: 'super_admin', name: 'Super Admin', nameBn: 'সুপার অ্যাডমিন', permissions: [...ALL_PERMISSIONS], isSystem: true, createdAt: new Date().toISOString() },
  { id: 'admin', name: 'Admin', nameBn: 'অ্যাডমিন', permissions: ALL_PERMISSIONS.filter((p) => p !== 'roles.manage' && p !== 'system.manage' && p !== 'backup.manage'), isSystem: true, createdAt: new Date().toISOString() },
  { id: 'store_manager', name: 'Store Manager', nameBn: 'স্টোর ম্যানেজার', permissions: ['dashboard.view', 'products.view', 'products.create', 'products.edit', 'categories.manage', 'brands.manage', 'orders.view', 'orders.edit', 'orders.export', 'customers.view', 'reports.view', 'reports.export'], isSystem: true, createdAt: new Date().toISOString() },
  { id: 'order_manager', name: 'Order Manager', nameBn: 'অর্ডার ম্যানেজার', permissions: ['dashboard.view', 'orders.view', 'orders.edit', 'orders.cancel', 'orders.export', 'payments.view', 'payments.verify', 'customers.view'], isSystem: true, createdAt: new Date().toISOString() },
  { id: 'content_manager', name: 'Content Manager', nameBn: 'কনটেন্ট ম্যানেজার', permissions: ['dashboard.view', 'content.manage', 'cms.manage', 'marketing.manage', 'seo.manage'], isSystem: true, createdAt: new Date().toISOString() },
  { id: 'customer_support', name: 'Customer Support', nameBn: 'কাস্টমার সাপোর্ট', permissions: ['dashboard.view', 'orders.view', 'customers.view', 'customers.manage'], isSystem: true, createdAt: new Date().toISOString() },
  { id: 'viewer', name: 'Viewer', nameBn: 'ভিউয়ার', permissions: ['dashboard.view', 'products.view', 'orders.view', 'customers.view', 'reports.view'], isSystem: true, createdAt: new Date().toISOString() },
  { id: 'customer', name: 'Customer', nameBn: 'কাস্টমার', permissions: [], isSystem: true, createdAt: new Date().toISOString() },
];

/** সাধারণ হ্যাশ (ডেমো): রিয়েল ব্যাকএন্ডে bcrypt/argon2 ব্যবহার করুন */
export function simpleHash(password: string, salt: string): string {
  let h1 = 0xdeadbeef ^ salt.length;
  let h2 = 0x41c6ce57 ^ password.length;
  const str = `${salt}::${password}::the-shop-bd`;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + (h2 >>> 0).toString(36);
}

function makeSalt(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * কোনো ইউজার/অ্যাডমিন হার্ডকোড করা হয় না — সিকিউরিটি।
 * • অ্যাডমিন: /admin URL এ প্রথম রেজিস্ট্রেশন করলেই অটো সুপার অ্যাডমিন (Firebase Auth)
 * • কাস্টমার: Google Sign-in বা ইমেইল রেজিস্ট্রেশন
 */
const DEFAULT_USERS: User[] = [];

// ───────────────────────────── ডিফল্ট পেজ (CMS) ─────────────────────────────
const DEFAULT_PAGES: CmsPage[] = [
  {
    id: 'page_about', slug: 'about', title: 'আমাদের সম্পর্কে', published: true,
    content: 'THE SHOP BD — বাংলাদেশের বিশ্বস্ত মাল্টিব্র্যান্ড অনলাইন শপ।\n\nআমাদের লক্ষ্য একটাই: ১০০% অরিজিনাল পণ্য সেরা দামে আপনার দরজায় পৌঁছে দেওয়া। Samsung, Xiaomi, Walton, Aarong, Sailor, Bata, Pran-সহ ২১+ বিখ্যাত ব্র্যান্ডের পণ্য এক জায়গায়।\n\nকেন THE SHOP BD?\n• ১০০% অরিজিনাল পণ্যের নিশ্চয়তা\n• সারাদেশে দ্রুত হোম ডেলিভারি\n• ক্যাশ অন ডেলিভারি সুবিধা\n• সহজ রিটার্ন ও রিফান্ড পলিসি\n• ২৪/৭ কাস্টমার সাপোর্ট',
    seoTitle: 'আমাদের সম্পর্কে — THE SHOP BD', seoDescription: 'THE SHOP BD সম্পর্কে জানুন', updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_contact', slug: 'contact', title: 'যোগাযোগ করুন', published: true,
    content: 'যেকোনো প্রশ্ন, অভিযোগ বা পরামর্শের জন্য আমাদের সাথে যোগাযোগ করুন।\n\nফোন: +৮৮০৯৬৪২-৯২২৯২২\nইমেইল: support@theshopbd.com\nঠিকানা: রামপুরা, ঢাকা-১২১৯, বাংলাদেশ\nসময়: প্রতিদিন সকাল ৯টা - রাত ১০টা\n\nঅথবা নিচের ফর্মটি পূরণ করে মেসেজ পাঠান — আমরা দ্রুত উত্তর দেবো।',
    seoTitle: 'যোগাযোগ — THE SHOP BD', seoDescription: 'The Shop BD-এর সাথে যোগাযোগ করুন', updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_faq', slug: 'faq', title: 'সাধারণ প্রশ্ন (FAQ)', published: true,
    content: 'প্রশ্ন: অর্ডার কীভাবে করবো?\nউত্তর: পছন্দের পণ্য কার্টে যোগ করে চেকআউট করুন। ক্যাশ অন ডেলিভারি বা মোবাইল ব্যাংকিংয়ে পেমেন্ট করতে পারবেন।\n\nপ্রশ্ন: ডেলিভারি চার্জ কত?\nউত্তর: ঢাকা সিটিতে ৳৬০, ঢাকার বাইরে ৳১২০। ৳২০০০+ অর্ডারে ফ্রি ডেলিভারি।\n\nপ্রশ্ন: পণ্য রিটার্ন করা যাবে কি?\nউত্তর: হ্যাঁ, পণ্য গ্রহণের ৭ দিনের মধ্যে রিটার্ন করা যাবে (শর্তসাপেক্ষে)।\n\nপ্রশ্ন: অর্ডার ট্র্যাক কীভাবে করবো?\nউত্তর: "অর্ডার ট্র্যাক" পেজে অর্ডার নাম্বার দিয়ে সরাসরি স্ট্যাটাস দেখতে পারবেন।',
    seoTitle: 'সাধারণ প্রশ্ন — THE SHOP BD', seoDescription: 'THE SHOP BD FAQ', updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_shipping', slug: 'shipping', title: 'শিপিং ও ডেলিভারি পলিসি', published: true,
    content: 'ডেলিভারি জোন ও চার্জ:\n• ঢাকা সিটি: ৳৬০ (২৪-৪৮ ঘণ্টা)\n• ঢাকা উপশহর: ৳৮০ (৪৮-৭২ ঘণ্টা)\n• ঢাকার বাইরে: ৳১২০ (৪৮-৭২ ঘণ্টা)\n\n৳২০০০+ অর্ডারে ঢাকা সিটিতে ফ্রি ডেলিভারি।\n\nস্টেডফাস্ট, পাঠাও কুরিয়ার ও রেডএক্সের মাধ্যমে সারাদেশে পাঠানো হয়।',
    seoTitle: 'শিপিং পলিসি — THE SHOP BD', seoDescription: 'ডেলিভারি চার্জ ও সময়সূচি', updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_cancellation', slug: 'cancellation', title: 'রিটার্ন ও রিফান্ড পলিসি', published: true,
    content: 'রিটার্নের নিয়ম:\n• পণ্য গ্রহণের ৭ দিনের মধ্যে রিটার্ন অনুরোধ করতে হবে\n• পণ্য অক্ষত ও অব্যবহৃত অবস্থায় ফেরত দিতে হবে\n• ভুল পণ্য বা ত্রুটিপূর্ণ পণ্যে ডেলিভারি চার্জ আমরা বহন করবো\n\nরিফান্ড:\n• রিটার্ন অনুমোদনের ৩-৫ কর্মদিবসের মধ্যে রিফান্ড প্রদান করা হয়\n• বিকাশ/নগদ/রকেটে রিফান্ড দেওয়া হয়\n\nঅর্ডার বাতিল: পাঠানোর আগে পর্যন্ত যেকোনো সময় বাতিল করা যাবে।',
    seoTitle: 'রিটার্ন পলিসি — THE SHOP BD', seoDescription: 'রিটার্ন, রিফান্ড ও বাতিলের নিয়ম', updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_terms', slug: 'terms', title: 'শর্তাবলী (Terms & Conditions)', published: true,
    content: 'THE SHOP BD ওয়েবসাইট ব্যবহারের শর্তাবলী:\n\n১. এই ওয়েবসাইটে দেওয়া সব দাম ও স্টক যেকোনো সময় পরিবর্তন হতে পারে।\n২. অর্ডার নিশ্চিত হওয়ার পর ফোনে যাচাই করা হয়।\n৩. ভুল ফোন নম্বর বা ঠিকানার কারণে ডেলিভারি ব্যর্থ হলে দায় গ্রাহকের।\n৪. কোনো পণ্যে ত্রুটি থাকলে ৭ দিনের মধ্যে জানাতে হবে।\n৫. কপিরাইট: সাইটের সব কনটেন্ট The Shop BD-এর সম্পত্তি।',
    seoTitle: 'শর্তাবলী — THE SHOP BD', seoDescription: 'ব্যবহারের শর্তাবলী', updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_privacy', slug: 'privacy', title: 'প্রাইভেসি পলিসি', published: true,
    content: 'আপনার তথ্যের নিরাপত্তা আমাদের কাছে সর্বোচ্চ গুরুত্বপূর্ণ।\n\n• আমরা শুধুমাত্র অর্ডার প্রক্রিয়াকরণের জন্য প্রয়োজনীয় তথ্য (নাম, ফোন, ঠিকানা) সংগ্রহ করি\n• আপনার তথ্য তৃতীয় পক্ষের কাছে বিক্রি করা হয় না\n• ডেলিভারির জন্য প্রয়োজনে কুরিয়ার সার্ভিসের সাথে ঠিকানা শেয়ার করা হয়\n• আপনি চাইলে আপনার সমস্ত ডেটা মুছে ফেলার অনুরোধ করতে পারেন',
    seoTitle: 'প্রাইভেসি পলিসি — THE SHOP BD', seoDescription: 'তথ্যের নিরাপত্তা নীতিমালা', updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_stories', slug: 'stories', title: 'কাস্টমার স্টোরিজ', published: true,
    content: 'আমাদের সম্মানিত কাস্টমারদের অভিজ্ঞতার গল্প।\n\nশারমিন আক্তার (মিরপুর): "আরং সালোয়ার কামিজ অর্ডার করেছিলাম। রং আর সাইজ নিজে বেছে নেওয়ার সুবিধাটা দারুণ লেগেছে।"\n\nআরিফুল ইসলাম (চট্টগ্রাম): "Havit-এর ইয়ারবাডস নিয়েছি, অরিজিনাল পণ্য। দ্রুত ডেলিভারি পেয়েছি।"\n\nমাহমুদ হাসান (সিলেট): "ক্যাশ অন ডেলিভারি সুবিধাটা অনেক ভরসা দেয়।"',
    seoTitle: 'কাস্টমার স্টোরিজ — THE SHOP BD', seoDescription: 'কাস্টমারদের অভিজ্ঞতা', updatedAt: new Date().toISOString(),
  },
];

// ───────────────────────────── Payment methods টাইপ ম্যাপ ─────────────────────────────
function methodType(name: string): PaymentMethod['type'] {
  if (name.includes('ক্যাশ')) return 'cod';
  if (name.includes('বিকাশ') || name.includes('নগদ') || name.includes('রকেট')) return 'mobile_banking';
  return 'card';
}

/** ডেটাবেস ভার্সন — স্কিমা পরিবর্তন হলে বাড়ান */
export const DB_VERSION = 6;

/** সম্পূর্ণ ডিফল্ট ডেটাবেস তৈরি */
export function buildSeedData() {
  const now = new Date().toISOString();
  const catMap = new Map<string, string>();
  const categories: Category[] = [];
  for (const c of categoriesSeed) {
    const id = `cat_${c.slug}`;
    catMap.set(c.slug, id);
    categories.push({ id, name: c.name, nameBn: c.nameBn, slug: c.slug, icon: c.icon, featured: c.featured, sortOrder: c.sortOrder, parentId: null });
  }
  for (const sc of subCategoriesSeed) {
    const id = `cat_${sc.slug}`;
    catMap.set(sc.slug, id);
    categories.push({ id, name: sc.name, nameBn: sc.nameBn, slug: sc.slug, icon: sc.icon, featured: false, sortOrder: sc.sortOrder, parentId: catMap.get(sc.parent)! });
  }

  const brandMap = new Map<string, string>();
  const brands: Brand[] = brandsSeed.map((b) => {
    const id = `brand_${b.slug}`;
    brandMap.set(b.slug, id);
    return { id, name: b.name, slug: b.slug, logo: `/brands/${b.slug}.svg` };
  });

  const products: Product[] = productsSeed.map((p, i) => ({
    id: `prd_${p.slug}`,
    name: p.name,
    nameBn: p.nameBn,
    slug: p.slug,
    sku: `TS-${p.slug.slice(0, 12).toUpperCase()}-${100 + i}`,
    description: p.description,
    shortDescription: p.shortDescription,
    price: p.price,
    comparePrice: p.comparePrice ?? null,
    unit: p.unit,
    stock: p.stock ?? 50,
    images: JSON.stringify(p.images),
    colors: p.colors ? JSON.stringify(p.colors) : null,
    sizes: p.sizes ? JSON.stringify(p.sizes) : null,
    categoryId: catMap.get(p.category)!,
    brandId: p.brand ? brandMap.get(p.brand)! : null,
    isFeatured: p.isFeatured ?? false,
    isNew: p.isNew ?? false,
    isBestSeller: p.isBestSeller ?? false,
    isPreOrder: p.isPreOrder ?? false,
    active: true,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    soldCount: p.soldCount ?? 0,
    weight: p.weight ?? null,
    origin: p.origin ?? null,
    variants: (p.variants || []).map((v): ProductVariant => ({
      key: `${v.color?.name || ''}|${v.size || ''}`,
      color: v.color?.name ?? null,
      colorHex: v.color?.hex ?? null,
      size: v.size ?? null,
      price: v.price,
      stock: v.stock,
      image: null,
    })),
  }));

  const slugToId = new Map(products.map((p) => [p.slug, p.id]));
  const reviews: Review[] = [];
  for (const [slug, list] of Object.entries(reviewsBySlug)) {
    const pid = slugToId.get(slug);
    if (!pid) continue;
    for (const r of list) {
      reviews.push({
        id: `rev_${pid}_${r.name.length}_${r.rating}`,
        productId: pid, userId: null, name: r.name, rating: r.rating,
        comment: r.comment, image: null, verifiedPurchase: true, helpfulCount: 0,
        status: 'APPROVED', adminReply: null, createdAt: now,
      });
    }
  }

  const paymentMethods: PaymentMethod[] = paymentMethodsSeed.map((pm, i) => ({
    id: `pay_${i + 1}`,
    name: pm.name,
    type: methodType(pm.name),
    logo: pm.logo,
    accountNumber: pm.accountNumber ?? null,
    instructions: pm.instructions,
    needsTrxId: pm.accountNumber != null,
    active: true,
    sortOrder: pm.sortOrder,
  }));

  const whyUs: WhyUsItem[] = featuresSeed.map((f, i) => ({
    id: `why_${i + 1}`, icon: f.icon, title: f.title, text: f.desc, active: true, sortOrder: f.sortOrder,
  }));

  const testimonials: Testimonial[] = testimonialsSeed.map((t, i) => ({
    id: `tst_${i + 1}`, name: t.name, role: t.area, text: t.text, rating: t.rating, avatar: null, active: true, sortOrder: t.sortOrder,
  }));

  const productPerks: ProductPerk[] = productPerksSeed.map((p, i) => ({
    id: `perk_${i + 1}`, icon: p.icon, title: p.title, subtitle: p.subtitle, active: true, sortOrder: p.sortOrder,
  }));

  return {
    version: DB_VERSION,
    categories,
    brands,
    products,
    reviews,
    orders: [],
    returnRequests: [],
    users: DEFAULT_USERS,
    addresses: [],
    roles: DEFAULT_ROLES,
    notifications: [],
    tickets: [],
    paymentMethods,
    transactions: [],
    deliveryZones: DEFAULT_DELIVERY_ZONES,
    couriers: DEFAULT_COURIERS,
    coupons: DEFAULT_COUPONS,
    slides: DEFAULT_SLIDES,
    sideBanners: DEFAULT_SIDE_BANNERS,
    whyUs,
    testimonials,
    productPerks,
    pages: DEFAULT_PAGES,
    subscribers: [],
    expenses: [],
    media: [],
    stockMovements: [],
    auditLogs: [],
    settings: { ...DEFAULT_SITE_SETTINGS },
    announcements: DEFAULT_ANNOUNCEMENTS.map((a) => ({ ...a })),
    flashSale: { enabled: false, title: 'ফ্ল্যাশ সেল', endsAt: null, productIds: [] },
    loyaltyLedger: [],
    referralEvents: [],
    referralWithdraws: [],
    abandonedCarts: [],
    smsLogs: [],
    pushTokens: [],
    customGateways: [],
  };
}

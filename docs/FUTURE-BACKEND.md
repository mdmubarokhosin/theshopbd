# ভবিষ্যতে রিয়েল ব্যাকএন্ড যোগ করার গাইড

এই প্রজেক্টটি ইচ্ছাকৃতভাবে **localStorage-first** আর্কিটেকচারে তৈরি — কারণ এখনকার মতো কোনো সার্ভার ছাড়াই সবকিছু কাজ করে (Termux/মোবাইলেও)। পরে রিয়েল ব্যাকএন্ড যোগ করতে চাইলে **UI-এর একটাও লাইন বদলাতে হবে না** — শুধু ডেটা লেয়ার বদলাবে।

## স্থাপত্য

```
┌─────────────────────────────────────────────┐
│  UI (React কম্পোনেন্ট)                        │  ← কখনো বদলাবে না
│  hooks: useCollection / useSettings / ...   │  ← কখনো বদলাবে না
├─────────────────────────────────────────────┤
│  services.ts + auth.ts                      │  ← ★ শুধু এই ফাইলগুলো বদলাবেন
│  (এখন: localStorage)  →  (পরে: fetch API)   │
├─────────────────────────────────────────────┤
│  রিয়েল ব্যাকএন্ড: Next.js API Routes /        │
│  Express + PostgreSQL/MySQL + Prisma        │
└─────────────────────────────────────────────┘
```

## ধাপ ১: ডেটাবেস স্কিমা

`src/lib/db/types.ts`-এর প্রতিটি টাইপ সরাসরি ডেটাবেস টেবিলে রূপান্তরযোগ্য:

| টাইপ | টেবিল | নোট |
|---|---|---|
| `Product` | products | variants → আলাদা product_variants টেবিল |
| `Category` | categories | parentId → self relation |
| `Brand` | brands | |
| `Order` | orders + order_items | statusHistory → order_events টেবিল |
| `User` | users | passwordHash → bcrypt দিয়ে |
| `Review`, `Coupon`, `PaymentTransaction`, `DeliveryZone`, `Courier`, `CmsPage`, `Role`, ... | যথাক্রমে | |

Prisma উদাহরণ:

```prisma
model Product {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  price     Float
  stock     Int
  categoryId String
  category  Category @relation(fields: [categoryId], references: [id])
  // ... types.ts-এর বাকি ফিল্ড
}
```

## ধাপ ২: API রুট তৈরি

`services.ts`-এর প্রতিটি ফাংশন REST এন্ডপয়েন্টে ম্যাপ করে:

| services.ts ফাংশন | API এন্ডপয়েন্ট |
|---|---|
| `queryProducts(q)` | `GET /api/products?search=&category=&page=` |
| `productBySlug(slug)` | `GET /api/products/:slug` |
| `saveProduct(input)` | `POST /api/admin/products` / `PUT /api/admin/products/:id` |
| `deleteProduct(id)` | `DELETE /api/admin/products/:id` |
| `getCart()` | `GET /api/cart` |
| `addToCart(...)` | `POST /api/cart` |
| `validateCoupon(code, subtotal)` | `POST /api/coupons/validate` |
| `placeOrder(input)` | `POST /api/orders` |
| `updateOrderStatus(...)` | `PATCH /api/admin/orders/:id/status` |
| `verifyTransaction(...)` | `PATCH /api/admin/transactions/:id` |
| `dashboardStats()` | `GET /api/admin/stats` |
| `login/register/logout` | `POST /api/auth/*` (NextAuth সুপারিশকৃত) |

## ধাপ ৩: সার্ভিস ফাংশন বদলানো

উদাহরণ — `productBySlug`:

```ts
// আগে (localStorage):
export function productBySlug(slug: string): Product | undefined {
  return db.collection('products').find((p) => p.slug === slug);
}

// পরে (API):
export async function productBySlug(slug: string): Promise<Product | undefined> {
  const res = await fetch(`/api/products/${slug}`);
  if (!res.ok) return undefined;
  return res.json();
}
```

## ধাপ ৪: hooks.ts সমন্বয়

React বাইন্ডিং `useSyncExternalStore` থেকে **TanStack Query**-তে বদলান:

```ts
export function useProducts(q: ProductQuery) {
  return useQuery({
    queryKey: ['products', q],
    queryFn: () => fetch(`/api/products?${new URLSearchParams(q as any)}`).then(r => r.json()),
  });
}
```

কম্পোনেন্টের ইমপোর্ট ও রিটার্ন-শেপ এক রাখলে UI কোড অপরিবর্তিত থাকবে।

## ধাপ ৫: নিরাপত্তা চেকলিস্ট (রিয়েল ব্যাকএন্ডে অবশ্যই)

- [ ] পাসওয়ার্ড: bcrypt/argon2 (`simpleHash` শুধু ডেমোর জন্য)
- [ ] সেশন: httpOnly cookie + JWT (এখন localStorage — XSS ঝুঁকি)
- [ ] **সব মূল্য/ডিস্কাউন্ট/স্টক সার্ভারে যাচাই** (services.ts-এর যাচাই-লজিক সার্ভারে সরান)
- [ ] প্রতিটি অ্যাডমিন API-তে `can(user, permission)` যাচাই (RBAC লজিক প্রস্তুতই আছে)
- [ ] Payment gateway: server-side verification + webhook signature
- [ ] ফাইল আপলোড: সার্ভার/CDN-এ (এখন base64 dataURL)
- [ ] Rate limiting (লগইন/OTP/চেকআউট)
- [ ] Audit log টেবিলে স্থায়ীভাবে

## সিমুলেটেড → রিয়েল ইন্টিগ্রেশন পয়েন্ট

| ফিচার | এখন | পরে বসানোর জায়গা |
|---|---|---|
| OTP | কোড UI-তে দেখায় (`auth.ts: sendOtp`) | SMS প্রোভাইডার: SSL Wireless / BulkSMSBD — সেটিংসে `sms_provider`, `sms_api_key` আছে |
| ইমেইল | — | SMTP — সেটিংসে `smtp_host/port/user` আছে |
| bKash/Nagad/Rocket | TrxID ম্যানুয়াল ভেরিফিকেশন | অফিসিয়াল checkout API — `PaymentMethod` মডেল প্রস্তুত |
| কুরিয়ার API | ম্যানুয়াল ট্র্যাকিং নম্বর | Steadfast/Pathao/REDX API — `Courier.apiKey/apiSecret` ফিল্ড আছে |
| কার্ড পেমেন্ট | গেটওয়ে-বিহীন | SSLCOMMERZ / ShurjoPay / Stripe |

## ডেটা মাইগ্রেশন

বর্তমান ব্যবহারকারীর localStorage ডেটা রিয়েল ডেটাবেসে নিতে:

1. অ্যাডমিন → ব্যাকআপ ও সিস্টেম → **JSON ডাউনলোড**
2. সার্ভারে একটি import স্ক্রিপ্ট চালান:
```ts
const data = JSON.parse(fs.readFileSync('backup.json', 'utf8'));
await prisma.product.createMany({ data: data.products });
// ... প্রতিটি কালেকশনের জন্য
```

## কী কী ইতিমধ্যে প্রোডাকশন-গ্রেড

✅ রোল-ভিত্তিক পারমিশন ম্যাট্রিক্স (RBAC) — লজিক সার্ভারে কপি করলেই হবে
✅ অর্ডার স্ট্যাটাস ট্রানজিশন ভ্যালিডেশন (`VALID_TRANSITIONS`)
✅ স্টক ডিডাকশন/রিলিজ + মুভমেন্ট হিস্ট্রি
✅ কুপন ভ্যালিডেশন (সব নিয়ম) — সার্ভার-সাইডে সরালেই নিরাপদ
✅ অ্যাটমিক অর্ডার তৈরি (`writeBulk` — এক ট্রানজেকশনে সব রাইট)
✅ অডিট লগিং প্যাটার্ন
✅ প্রাইস/স্টক রিভ্যালিডেশন চেকআউটে

# THE SHOP BD — Firebase সেটআপ গাইড

এই ওয়েবসাইটের **সব ডেটা Firebase Realtime Database (RTDB)** থেকে লোড হয়।
**Firestore কোথাও ব্যবহার করা হয় না।** ইমেজ/ভিডিও হোস্টিং হয় **GitHub রিপো + jsDelivr CDN** দিয়ে।

---

## ১. Firebase প্রজেক্ট

কনফিগ ফাইল: `src/lib/firebase/app.ts` — এখানে `firebaseConfig` অবজেক্টে আপনার
প্রজেক্টের apiKey/authDomain/databaseURL/projectId ইত্যাদি আছে। নতুন প্রজেক্টে
সরাতে চাইলে শুধু এই অবজেক্টটি বদলান।

### Firebase Console-এ যা যা চালু থাকতে হবে

| সার্ভিস | কোথায় | সেটিং |
|---|---|---|
| **Realtime Database** | Build → Realtime Database | ডেটাবেজ তৈরি করুন। Rules নিচে দেখুন |
| **Authentication** | Build → Authentication → Sign-in method | **Email/Password** ও **Google** — দুটোই Enable |
| **Analytics** | ঐচ্ছিক | measurementId কনফিগে আছে, সাপোর্টেড ব্রাউজারে অটো চালু হয় |

### Realtime Database Rules — প্রোডাকশন

প্রোডাকশনে এই রুলসটি বসান (Firebase Console → Realtime Database → Rules →
Publish)। প্রজেক্টের রুটে **`database.rules.json`** ফাইলেও একই কোড আছে।

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "shop": {
      ".read": true,
      ".write": true
    }
  }
}
```

**কেন এভাবে?**

- রুট লেভেলে সব বন্ধ — শুধু `shop` নোডেই পড়া/লেখা যাবে। একই প্রজেক্টে অন্য
  অ্যাপের ডেটা থাকলে সেটি সম্পূর্ণ সুরক্ষিত থাকে।
- `shop` পাবলিক রিড — লগইন ছাড়াই স্টোরফ্রন্ট সব ডেটা (পণ্য/কনটেন্ট/সেটিংস)
  রিয়েল-টাইমে লোড করতে পারে।
- `shop` রাইট খোলা — এই অ্যাপের সিঙ্ক ইঞ্জিন (`src/lib/db/cloud.ts`) পুরো
  ট্রি এক কলে push করে; ফলে নিচের তিনটি ফ্লো একসাথে কাজ করে:
  ১) প্রথম ভিজিটে ফাঁকা RTDB-তে ডেমো-ডেটা বুটস্ট্র্যাপ, ২) **গেস্ট চেকআউট**
  (লগইন ছাড়া অর্ডার + স্টক আপডেট), ৩) অ্যাডমিনের সব মিউটেশন।

**হার্ডেনিং (ঐচ্ছিক):** যদি গেস্ট চেকআউট বন্ধ করে সব অর্ডার লগইন-পূর্বক করতে চান:

```json
{ "rules": { ".read": false, ".write": false, "shop": { ".read": true, ".write": "auth != null" } } }
```

তখন Firebase Console → Authentication-এ Anonymous provider চালু রাখা ভালো
(প্রথম বুটস্ট্র্যাপ ও পেমেন্ট ফ্লো যেন ভাঙে না)। আরও কড়া নিয়ন্ত্রণের জন্য
পরবর্তী ধাপ হলো **Firebase App Check** (reCAPTCHA v3) — চালু করলে শুধু আপনার
ওয়েবসাইট থেকেই লেখা যাবে; স্ক্রিপ্ট/বট প্লেন API রিকোয়েস্ট ফেরত চলে যাবে।

### ডেটার গঠন

পুরো ওয়েবসাইটের ডেটা একটি নোডে থাকে: **`shop`** — এর ভেতরে:

```
shop/
├── version            # ডেটা-স্কিমা ভার্সন
├── settings           # সাইটের A-to-Z সেটিংস (ব্র্যান্ড নাম, লোগো, যোগাযোগ, GitHub কনফিগসহ)
├── products           # সব পণ্য
├── categories         # ক্যাটাগরি ট্রি
├── brands             # ব্র্যান্ড
├── orders             # সব অর্ডার (স্ট্যাটাস হিস্ট্রিসহ)
├── users              # কাস্টমার/স্টাফ/অ্যাডমিন প্রোফাইল (id = Firebase Auth uid)
├── roles              # RBAC রোল ও পারমিশন
├── announcements      # স্লাইডিং ঘোষণা (অ্যাডমিন থেকে যোগ/এডিট/ডিলিট/বন্ধ)
├── slides, sideBanners, testimonials, whyUs, pages, coupons,
├── paymentMethods, deliveryZones, couriers, reviews, tickets...
└── flashSale
```

- **প্রথম রানে** RTDB ফাঁকা থাকলে সাইট নিজে থেকেই ডিফল্ট ডেমো-ডেটা বুটস্ট্র্যাপ করে
  (`src/lib/db/seed-data.ts`)। এরপর সব পড়া/লেখা RTDB-তেই হয়।
- কোনো তথ্য কোডে হার্ডকোড করা নেই — অ্যাডমিন প্যানেল থেকে সব বদলানো যায়।

---

## ২. অ্যাডমিন সেটআপ (অটো-বুটস্ট্র্যাপ)

1. ব্রাউজারে সরাসরি `https://আপনার-ডোমেন.com/admin` খুলুন।
2. Firebase/RTDB-তে **কোনো অ্যাডমিন না থাকলে** → **রেজিস্ট্রেশন ফর্ম** খুলবে —
   যে প্রথম রেজিস্ট্রেশন করবে সে-ই **অটোমেটিক সুপার অ্যাডমিন** হবে।
3. অ্যাডমিন **একবার থাকলে** → এই URL-এ শুধু **লগইন ফর্ম** দেখাবে।
4. নতুন স্টাফ অ্যাকাউন্ট: অ্যাডমিন প্যানেল → রোল ও স্টাফ → স্টাফ তৈরি
   (Firebase Auth-এ সেকেন্ডারি অ্যাপ দিয়ে তৈরি হয় — আপনার সেশন অটুট থাকে)।

> সুরক্ষা: কোনো ডিফল্ট ইমেইল/পাসওয়ার্ড কোডে রাখা নেই। অ্যাকাউন্ট তৈরি হয়
> Firebase Authentication দিয়েই।

---

## ৩. ইউজার লগইন (Google Sign-in)

- `/login` ও `/register` পেজে **"Google দিয়ে লগইন/রেজিস্ট্রেশন"** বাটন আছে।
- Google দিয়ে লগইন করলে নাম, ইমেইল ও প্রোফাইল ছবি **Google অ্যাকাউন্ট থেকে
  অটো-ফিল** হয়ে RTDB `users` রেকর্ডে সেভ হয়।
- ইমেইল+পাসওয়ার্ড লগইন/রেজিস্ট্রেশন এবং রিয়েল পাসওয়ার্ড-রিসেট ইমেইলও কাজ করে।
- শর্ত: Firebase Console → Authentication → Sign-in method-এ **Google** ও
  **Email/Password** দুটোই enable থাকতে হবে। Google-এর জন্য Authorized
  domain-এ আপনার ডোমেন যোগ করুন (Authentication → Settings → Authorized domains)।

---

## ৪. GitHub রিপো হোস্টিং (ইমেজ/ভিডিও)

ছবি/ভিডিও Firebase Storage বা Firestore-এ যায় না — **GitHub Contents API** দিয়ে
আপনার রিপোতে কমিট হয় এবং সাইটে লোড হয় **jsDelivr CDN** থেকে:

```
আপলোড: PUT https://api.github.com/repos/{owner}/{repo}/contents/uploads/products/...
লোড  : https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}
```

### সেটআপ (অ্যাডমিন প্যানেল → ওয়েবসাইট সেটিংস → GitHub হোস্টিং ট্যাব)

1. GitHub-এ একটি **Public** রিপোজিটরি তৈরি করুন (যেমন: `theshopbd-media`)।
2. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token:
   - Repository access: **Only select repositories** → মিডিয়া রিপোটি বাছুন
   - Permissions → **Contents → Read and write**
3. অ্যাডমিন প্যানেলের GitHub ট্যাবে Owner / Repo / Branch / Folder / Token বসিয়ে
   **সেভ করুন** → **সংযোগ পরীক্ষা** চাপুন (রিপো + ব্রাঞ্চ + jsDelivr তিনটাই চেক হয়)।
4. কনফিগারেশনটি Firebase RTDB-র `settings`-এ সংরক্ষিত হয় — এরপর পণ্য, ব্যানার,
   লোগো, প্রোফাইল ছবি সব আপলোড অটোমেটিক এই রিপোতে যাবে।

> টোকেন লিক হলে GitHub-এ revoke করে নতুন টোকেন বসান। টোকেনটি শুধু ওই এক রিপোর
> Contents পারমিশনেই সীমাবদ্ধ রাখুন।

---

## ৫. স্থাপন (Deploy)

```bash
npm install        # বা bun install
npm run dev        # ডেভেলপমেন্ট (Termux-এ scripts/next-runner.mjs নিজেই --webpack যোগ করে)
npm run build      # প্রোডাকশন বিল্ড
npm start          # প্রোডাকশন সার্ভার
```

Vercel/Netlify/cPanel(Node)-এ হোস্ট করা যায় — শুধু নিশ্চিত করুন ভিজিটরের ব্রাউজার
Firebase (firebasedatabase.googleapis.com) ও jsDelivr-এ পৌঁছাতে পারে।

## ৬. ব্যাকআপ ও রিসেট

- অ্যাডমিন প্যানেল → ব্যাকআপ ও সিস্টেম → **JSON এক্সপোর্ট/ইমপোর্ট**
  (পুরো RTDB ডেটা ডাউনলোড/রিস্টোর হয়)।
- রিসেট করলে ডিফল্ট ডেমো ডেটা আবার RTDB-তে বসে যায়।

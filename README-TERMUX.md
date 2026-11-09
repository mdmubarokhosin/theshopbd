# 📱 THE SHOP BD — Termux (মোবাইল) টেস্ট গাইড (v6)

এই zip দিয়ে আপনি **কোনো PC ছাড়াই, শুধু ফোনে** সম্পূর্ণ THE SHOP BD সাইট (সব নতুন ফিচারসহ) চালিয়ে টেস্ট করতে পারবেন। সব ডেটা আপনার Firebase Realtime Database-এ থাকে, তাই ফোনে টেস্ট করা অর্ডার/পণ্য আপনার লাইভ সাইটেও দেখা যাবে (উল্টোটাও সত্যি)।

> 🆕 **v6-এ নতুন:** WhatsApp অর্ডার বাটন, GA4/Pixel, PWA+পুশ, SMS, Steadfast কুরিয়ার, bKash/SSLCommerz গেটওয়ে, লয়ালটি পয়েন্ট, রেফারেল, অ্যাব্যান্ডন্ড কার্ট, রিভিউ ছবি — সেটআপ গাইড: `docs/NEW-FEATURES.md`

---

## ০. আগে যা লাগবে

| কী | কতটুকু |
|---|---|
| Android ভার্সন | 8.0+ |
| খালি স্টোরেজ | **কমপক্ষে 2 GB** (node_modules বড়) |
| খালি RAM | 2 GB+ (ভালো) |
| Termux অ্যাপ | **F-Droid থেকে** ইনস্টল করুন (⚠ Play Store-এর Termux পুরনো/বন্ধ — ব্যবহার করবেন না) |
| ইন্টারনেট | লাগবে (npm install + Firebase) |

> Termux F-Droid লিংক: https://f-droid.org/packages/com.termux/

---

## ১. ইনস্টলেশন (প্রথমবার — ১৫/২০ মিনিট)

Termux খুলে **একটার পর একটা** কমান্ড দিন:

```bash
# ১) প্যাকেজ আপডেট
pkg update -y && pkg upgrade -y

# ২) Node.js (20+) ও zip টুল ইনস্টল
pkg install nodejs unzip -y

# ৩) ভার্সন যাচাই — 20 বা তার বেশি দেখাতে হবে
node -v
```

এরপর এই zip-টা ফোনের **Downloads** ফোল্ডারে রেখে:

```bash
# ৪) ফোনের স্টোরেজ পারমিশন দিন (পপআপে Allow চাপবেন)
termux-setup-storage

# ৫) Downloads থেকে প্রজেক্ট খুলে নিন
cd ~
unzip "/sdcard/Download/THE-SHOP-BD-Termux-Test.zip" -d ~
cd ~/the-shop-bd

# ৬) ডিপেন্ডেন্সি ইনস্টল (৫–১০ মিনিট লাগবে, ধৈর্য ধরুন)
npm install --no-audit --no-fund
```

> নাম ভিন্ন হলে: `ls /sdcard/Download/` দিয়ে আসল ফাইলনাম দেখে সেটাই unzip করবেন।

---

## ২. চালু করা

```bash
cd ~/the-shop-bd
npm run dev
```

`✓ Ready` দেখলে ফোনের **Chrome** খুলে যান:

```
http://localhost:3000
```

ব্যাস — সম্পূর্ণ সাইট ফোনেই চলছে! 🎉

**কিছু করতে হয় না:** Next.js 16-এর Turbopack Android-এ চলে না — `scripts/next-runner.mjs` নিজেই Termux শনাক্ত করে webpack মোডে চালায়। প্রথম পেজ লোডে **১–৩ মিনিট** কম্পাইল হতে পারে (স্বাভাবিক), পরেরবার দ্রুত হবে।

---

## ৩. প্রতিদিন চালাতে চাইলে (শর্টকাট)

নতুন সেশনে Termux খুলে মাত্র:

```bash
cd ~/the-shop-bd && npm run dev
```

থামাতে: টার্মিনালে **Volume Down + C** একসাথে চাপুন।

**টিপ:** বন্ধ হয়ে গেলে/ফোন লক হলে Termux-এর নোটিফিকেশন **Acquire wakelock** চাপে রাখুন, আর Termux সম্পূর্ণ কিল করবেন না (Recent apps → lock করুন)।

---

## ৪. অন্য ডিভাইস থেকে টেস্ট (একই WiFi)

```bash
npm run dev -- -H 0.0.0.0
```

তারপর অন্য ফোন/ল্যাপটপের ব্রাউজারে: `http://<আপনার-ফোনের-IP>:3000`
(আপনার ফোনের IP দেখতে: Termux-এ `ifconfig -a | grep inet` বা WiFi সেটিংস)

---

## ৫. প্রোডাকশন-মোড টেস্ট (ঐচ্ছিক)

ফোনেই আসল প্রোডাকশন বিল্ড টেস্ট করতে চাইলে:

```bash
cd ~/the-shop-bd
npm run build     # ফোনে ৫–১৫ মিনিট লাগতে পারে
npm start         # তারপর localhost:3000
```

> টেস্টের জন্য dev মোডই যথেষ্ট; build হালকা ফোনে ধীর — ইচ্ছা হলেই করবেন।

---

## ৬. নতুন ফিচার টেস্ট চেকলিস্ট (v6)

- [ ] অ্যাডমিন প্যানেলে নতুন মেনু: **গ্রোথ ও রিটেনশন** + **ইন্টিগ্রেশন** গ্রুপ দেখাচ্ছে
- [ ] ইন্টিগ্রেশন → WhatsApp অর্ডার → নম্বর দিয়ে চালু → পণ্য পেজে সবুজ বাটন
- [ ] ইন্টিগ্রেশন → GA4 ও পিক্সেল → টেস্ট করতে ব্রাউজার DevTools → Network-এ gtag কল
- [ ] ইন্টিগ্রেশন → পুশ নোটিফিকেশন → VAPID key দিলে পারমিশন পপআপ + টেস্ট নোটিফিকেশন
- [ ] ইন্টিগ্রেশন → SMS → প্রোভাইডার কনফিগ → টেস্ট SMS
- [ ] গেটওয়ে → bKash sandbox কনফিগ → চেকআউটে নতুন মেথড
- [ ] লয়ালটি চালু → টেস্ট অর্ডার DELIVERED করলে পয়েন্ট + চেকআউটে ছাড়
- [ ] রেফারেল চালু → অ্যাকাউন্টে কোড + শেয়ার লিংক

⚠️ **মনে রাখুন:** Firebase Rules-এ নতুন `webhooks` নোড পাবলিশ করতে হবে — `database.rules.json` ফাইলের কনটেন্ট Firebase Console-এ পেস্ট করুন (docs/NEW-FEATURES.md উপরের অংশ)।

---

## ৭. সমস্যা হলে

| লক্ষণ | সমাধান |
|---|---|
| `EACCES: permission denied` | `termux-setup-storage` আবার চালান, Allow করুন |
| `No space left on device` | স্টোরেজ খালি করুন (দরকার 2GB+), অপ্রয়োজনীয় অ্যাপ মুছুন |
| `Port 3000 is already in use` | আগের সার্ভার বন্ধ করুন (Volume Down+C) অথবা: `npm run dev -- -p 3001` |
| install-এ মাঝপথে বন্ধ/কিল | ফোন গরম/র‍্যাম শেষ — সব অ্যাপ বন্ধ করে আবার `npm install` দিন |
| পেজ খোলে কিন্তু ডেটা আসে না | ইন্টারনেট চেক করুন; Firebase Rules দেখুন (docs/FIREBASE-SETUP.md) |
| `Turbopack is not supported` | হবে না — runner অটো webpack দেয়; তবু হলে: `TSB_BUNDLER=webpack npm run dev` |
| Play Store-এর Termux-এ সব ফেল | F-Droid ভার্সন ব্যবহার করুন |

---

## ৮. মনে রাখুন

- এটা **টেস্ট বিল্ড** — ফোনে ২৪ ঘণ্টা সার্ভার চালানোর জন্য নয়। লাইভ কাস্টমার পেতে হোস্টিংগার zip ব্যবহার করুন।
- ফোনে করা পরিবর্তন (পণ্য/অর্ডার) Firebase-এ সেভ হয় — লাইভ সাইটেও দেখাবে। টেস্ট ডেটা মুছতে অ্যাডমিন প্যানেল ব্যবহার করুন।
- কোড এডিট করতে চাইলে Termux-এও পারবেন: `nano src/components/store/home-view.tsx` (সেভ: Ctrl+O, বের: Ctrl+X) — কিন্তু বড় কাজের জন্য Source-Code.zip ব্যবহার করুন।

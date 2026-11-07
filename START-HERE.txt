# 🌐 THE SHOP BD — Hostinger ডিপ্লয় কুইক গাইড (v6)

**বিস্তারিত গাইড:** `docs/HOSTINGER-DEPLOY.md` (প্ল্যান অনুযায়ী দুটি পদ্ধতি: hPanel Node.js অ্যাপ এবং VPS)
**🆕 নতুন ফিচার সেটআপ:** `docs/NEW-FEATURES.md` — WhatsApp, SMS, Steadfast, bKash/SSLCommerz, লয়ালটি, রেফারেল, পুশ — সবগুলোর ধাপে ধাপে গাইড

---

## ৫ মিনিটের চেকলিস্ট

### ১) কোড আপলোড
hPanel → **File Manager** → আপনার Node.js অ্যাপের ফোল্ডার (যেমন `domains/yourdomain.com/app`) → এই zip আপলোড করে **Extract** করুন — `package.json`, `server.js` অ্যাপ রুটে থাকতে হবে।

### ২) Node.js অ্যাপ তৈরি
hPanel → **Advanced → Node.js** → Create application:

| ফিল্ড | মান |
|---|---|
| Application root | কোড যেখানে রাখলেন |
| Application startup file | **`server.js`** |
| Node.js version | **20.x বা তার উপরে** |

### ৩) Environment Variables (⚠ খুব গুরুত্বপূর্ণ)

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` |

> `NEXT_PUBLIC_SITE_URL` না দিলে: **sitemap/robots-এ localhost URL** যাবে + **bKash/SSLCommerz কলব্যাক আপনার ডোমেইনে ফিরবে না** (গেটওয়ে কাজ করবে না)। গেটওয়ে ব্যবহার করলে এটা বাধ্যতামূলক।

### ৪) বিল্ড
hPanel Node.js পেজের টার্মিনালে (অথবা SSH):

```bash
cd ~/domains/yourdomain.com/app   # আপনার পাথ অনুযায়ী
npm install --no-audit --no-fund
npm run build
```

তারপর hPanel-এ **Restart** → স্ট্যাটাস Running।

### ৫) Firebase Rules (⚠ v6-এ নতুন ধাপ)
Firebase Console → Realtime Database → Rules → প্রজেক্টের `database.rules.json` ফাইলের কনটেন্ট পেস্ট করে **Publish** করুন। নতুন `webhooks` নোড ছাড়া SMS ক্রন/গেটওয়ে ইভেন্ট কাজ করবে না।

### ৬) ডোমেইন + SSL + Firebase
- hPanel → Domains → **Force HTTPS** চালু করুন
- Security → SSL → ফ্রি Let's Encrypt ইনস্টল
- Firebase Console → Authentication → Settings → **Authorized domains**-এ আপনার ডোমেইন যোগ করুন

---

## এই বিল্ডে যা আছে (v6)

🆕 **১০টি নতুন ফিচার** (সব অ্যাডমিন-কন্ট্রোলড): WhatsApp অর্ডার বাটন+ফ্লোটিং চ্যাট, GA4+FB Pixel ইভেন্ট, PWA+পুশ (FCM), SMS (Bulk SMS BD/SSL Wireless/কাস্টম), Steadfast কুরিয়ার API, bKash Tokenized + SSLCommerz + কাস্টম গেটওয়ে, লয়ালটি পয়েন্ট, রেফারেল কমিশন, অ্যাব্যান্ডন্ড কার্ট, রিভিউতে ছবি।
সেটআপ: **docs/NEW-FEATURES.md**

🔧 **আগের ফিক্স:** `/robots.txt` 500 এরর ফিক্স (public/robots.txt ও src/app/robots.ts কনফ্লিক্ট)।

✅ **ভেরিফাইড:** `npm install` → `npm run build` (২৬+ রুট) → `server.js` production মোডে সব রুট HTTP 200 (/, /shop, /product, /login, /admin, /pay/*, /api/*)।

## ডিপ্লয়ের পর যাচাই

- [ ] হোমপেজে পণ্য/ব্যানার দেখাচ্ছে (Firebase RTDB সংযোগ OK)
- [ ] `/robots.txt` ও `/sitemap.xml` খোলে, ভিতরে আপনার ডোমেইনের URL
- [ ] `/admin` → লগইন → নতুন মেনু গ্রুপ (গ্রোথ ও রিটেনশন / ইন্টিগ্রেশন) দেখাচ্ছে
- [ ] Google লগইন কাজ করে
- [ ] একটা টেস্ট অর্ডার দিয়ে চেকআউট→ট্র্যাকিং ফ্লো দেখুন
- [ ] (গেটওয়ে করলে) Sandbox মোডে টেস্ট পেমেন্ট সফল

## আপডেট ডিপ্লয় (পরে নতুন ভার্সন বসাতে)

```bash
cd <অ্যাপ ফোল্ডার>
# নতুন কোড আপলোড করুন
npm install
npm run build
pm2 restart theshopbd   # অথবা hPanel Restart
```

> ডেটা Firebase-এ থাকে — কোড আপডেটে হারায় না। ডেটা স্কিমা v6-এ অটো-মাইগ্রেট হবে। তবু বড় পরিবর্তনের আগে অ্যাডমিন → ব্যাকআপ ও সিস্টেম → JSON এক্সপোর্ট।

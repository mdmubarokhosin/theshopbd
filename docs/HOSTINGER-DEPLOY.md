# THE SHOP BD — Hostinger ডিপ্লয়মেন্ট গাইড

এই গাইড ধরে সাইটটি **Hostinger**-এ প্রোডাকশনে চালানো হবে। পুরো প্রক্রিয়া ২০–৩০ মিনিট।

---

## ০. আগে জেনে নিন — কোন প্ল্যান লাগবে?

Next.js অ্যাপ চালাতে **Node.js সাপোর্ট** দরকার:

| Hostinger প্ল্যান | Next.js চলবে? | পদ্ধতি |
|---|---|---|
| **VPS / KVM VPS** | ✅ সবচেয়ে ভালো | পদ্ধতি B (নিচে) |
| **Cloud / Business + Node.js ফিচার** (hPanel → Advanced → Node.js) | ✅ | পদ্ধতি A (নিচে) |
| সাধারণ **Shared/Premium** (শুধু PHP) | ❌ Node.js নেই | VPS-এ মাইগ্রেট করুন বা static হোস্টিং (এই অ্যাপ dynamic তাই সম্ভব নয়) |

> hPanel-এ **Advanced → Node.js** মেনু থাকলেই আপনার প্ল্যানে Node.js সাপোর্ট আছে।

**সাইটের ডেটা কোথায় থাকে?** সব ডেটা Firebase Realtime Database-এ — তাই হোস্টিং সার্ভারে কোনো ডেটাবেস লাগে না। সার্ভার শুধু ওয়েবসাইট সার্ভ করবে। ভিজিটরের ব্রাউজার থেকে `firebasedatabase.googleapis.com` ও `cdn.jsdelivr.net`-এ পৌঁছাতে পারতে হবে (সাধারণত সবসময় পারে)।

---

## ১. প্রস্তুতি (Firebase অংশ — একবারই)

কোডে Firebase কনফিগ আগেই বসানো আছে (`src/lib/firebase/app.ts`)। শুধু নিশ্চিত করুন:

1. **Realtime Database** তৈরি আছে এবং Rules প্রকাশিত — প্রজেক্টের `database.rules.json` ফাইলের কনটেন্ট Firebase Console → Realtime Database → Rules → Publish
2. **Authentication → Sign-in method**: Email/Password + Google দুটোই Enabled
3. **Authentication → Settings → Authorized domains**: আপনার Hostinger ডোমেইন (যেমন `yourdomain.com`) যোগ করুন — নইলে Google লগইন কাজ করবে না

বিস্তারিত: [FIREBASE-SETUP.md](FIREBASE-SETUP.md)

---

## ২. পদ্ধতি A — hPanel Node.js অ্যাপ (সহজ)

### ধাপ ১: সোর্স কোড আপলোড

hPanel → **File Manager** (বা FTP):
1. আপনার অ্যাপ ডিরেক্টরি খুলুন (Node.js অ্যাপ তৈরির সময় যে ফোল্ডার সেট করবেন, যেমন `domains/yourdomain.com/app`)
2. সোর্স কোড zip আপলোড করে এক্সট্র্যাক্ট করুন — `package.json` যেন অ্যাপ রুটে থাকে

### ধাপ ২: Node.js অ্যাপ তৈরি

hPanel → **Advanced → Node.js** → Create application:

| ফিল্ড | মান |
|---|---|
| Application root | `domains/yourdomain.com/app` (কোড যেখানে রেখেছেন) |
| Application URL | আপনার ডোমেইন |
| Application startup file | **`server.js`** |
| Node.js version | **20.x বা তার উপরে** (Next.js 16-এর ন্যূনতম 20.9) |

### ধাপ ৩: এনভায়রনমেন্ট ভেরিয়েবল

Node.js অ্যাপ পেজে → Environment Variables:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |

> PORT হোস্টিং নিজেই দেয় — `server.js` সেটি অটো ধরে নেয়।

### ধাপ ৪: বিল্ড ও চালু

hPanel → Node.js অ্যাপ পেজের **NPM install** বাটন চাপুন (অথবা টার্মিনালে):

```bash
cd ~/domains/yourdomain.com/app
npm install          # ২–৫ মিনিট
npm run build        # প্রোডাকশন বিল্ড
```

এরপর hPanel-এ **Restart** চাপুন — `server.js` চালু হবে। অ্যাপ স্ট্যাটাস **Running** দেখাবে।

### ধাপ ৫: ডোমেইন ও SSL

- hPanel → Domains → ডোমেইন → **Force HTTPS** চালু করুন (Google লগইনের জন্য HTTPS আবশ্যক)
- SSL: hPanel → Security → SSL — ফ্রি Let's Encrypt ইনস্টল করুন

---

## ৩. পদ্ধতি B — VPS (SSH টার্মিনাল)

```bash
# ১) Node.js 20+ ইনস্টল (Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# ২) কোড আপলোড (git clone বা SFTP)
cd /var/www
sudo git clone <আপনার-রিপো> theshopbd   # অথবা zip আপলোড করে এক্সট্র্যাক্ট
cd theshopbd

# ৩) বিল্ড
npm install
npm run build

# ৪) PM2 দিয়ে চিরস্থায়ী চালু
sudo npm install -g pm2
pm2 start server.js --name theshopbd
pm2 save && pm2 startup    # সার্ভার রিবুটেও অটো চালু
```

Nginx reverse proxy (optional):

```nginx
server {
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

পোর্ট বদলাতে: `PORT=4000 pm2 start server.js`

---

## ৪. স্থাপনের পর যাচাই-তালিকা

- [ ] হোমপেজ লোড হয়, পণ্য/ব্যানার দেখায় (RTDB সিঙ্ক কাজ করছে)
- [ ] প্রথম ভিজিটে RTDB ফাঁকা থাকলে ডেমো ডেটা অটো-বুটস্ট্র্যাপ হয়
- [ ] `/admin` খুলে প্রথম অ্যাডমিন রেজিস্ট্রেশন করুন (অটো সুপার অ্যাডমিন)
- [ ] Google লগইন কাজ করে (Authorized domains চেক করুন)
- [ ] অ্যাডমিন → সেটিংস → **GitHub হোস্টিং** ট্যাবে মিডিয়া রিপো কনফিগার করুন (ছবি আপলোডের জন্য)
- [ ] মোবাইল থেকে সাইট + `/search` পেজ দেখুন

## ৫. সমস্যা হলে

| লক্ষণ | সমাধান |
|---|---|
| বিল্ডে `TurbopackInternalError: Failed to write app endpoint /page` | **আগেই ঠিক করা আছে** — `scripts/next-runner.mjs` বিল্ড অটোমেটিক **webpack** বান্ডলারে চালায় (Hostinger-সহ কিছু বিল্ড কনটেইনারে Turbopack-এর PostCSS worker ক্র্যাশ করে)। নিজে জোর করে: `TSB_BUNDLER=webpack npm run build` |
| বিল্ডে `Cannot find module '...'` (TS2307) | অব্যবহৃত কম্পোনেন্ট ফাইলের ইনস্টল-করা-নেই প্যাকেজ — এই সোর্স zip-এ সব অব্যবহৃত scaffold ফাইল মুছে দেওয়া আছে; GitHub-এ পুরো প্রজেক্ট সিঙ্ক করুন |
| অ্যাপ চালু হয় না: `Next.js পাওয়া যায়নি` | `npm install` চালানো হয়নি — Node.js অ্যাপ টার্মিনালে install করুন |
| `npm run build` ব্যর্থ | Node ভার্সন 20.9+ কিনা দেখুন (`node -v`) |
| npm-এ `EBADENGINE` ওয়ার্নিং (firebase/node >= 24) | নিরাপদে উপেক্ষা করা যায় — Firebase SDK ব্রাউজারে চলে, বিল্ড আটকায় না |
| পেজ খোলে কিন্তু ডেটা/লগইন কাজ করে না | ব্রাউজার DevTools → Console-এ দেখুন — RTDB Rules বা Auth domain সমস্যা |
| `Permission denied` (RTDB) | Firebase Console → Realtime Database → Rules ঠিক করে Publish করুন |
| Google লগইনে `auth/unauthorized-domain` | Firebase → Authentication → Settings → Authorized domains-এ ডোমেইন যোগ করুন |

## ৬. আপডেট ডিপ্লয় (নতুন ভার্সন বসানো)

```bash
cd <অ্যাপ ফোল্ডার>
# নতুন কোড আপলোড/clone (node_modules ও .next রাখবেন না)
npm install
npm run build
pm2 restart theshopbd      # অথবা hPanel-এ Restart
```

> ডেটা নিয়ে চিন্তা নেই — সব ডেটা Firebase RTDB-তে, কোড আপডেটে হারায় না। যেকোনো বড় পরিবর্তনের আগে অ্যাডমিন → ব্যাকআপ ও সিস্টেম → JSON এক্সপোর্ট নিয়ে রাখুন।

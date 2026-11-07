/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS ইচ্ছাকৃত: Hostinger Node.js স্টার্টআপ ফাইল */
/**
 * THE SHOP BD — Hostinger প্রোডাকশন সার্ভার এন্ট্রি ফাইল
 * ─────────────────────────────────────────────────────────────
 * Hostinger hPanel → Advanced → Node.js → Application startup file: **server.js**
 *
 * • PORT এনভায়রনমেন্ট ভেরিয়েবল অটো সম্মান করে (হোস্টিং প্রোভাইডার যা দেয়)
 *   না দিলে ডিফল্ট ৩০০০।
 * • NODE_ENV=production হলে প্রি-বিল্ড করা `.next` ফোল্ডার সার্ভ করে।
 *
 * বিল্ড আগে একবার করতে হবে (হোস্টিং টার্মিনালে):
 *   npm install
 *   npm run build
 *
 * বিস্তারিত গাইড: docs/HOSTINGER-DEPLOY.md
 */
const { createServer } = require('http');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, () => {
      console.log(`✓ THE SHOP BD চলছে → http://${hostname}:${port} (${dev ? 'development' : 'production'} mode)`);
    });
  })
  .catch((err) => {
    console.error('✗ সার্ভার চালু ব্যর্থ:', err);
    process.exit(1);
  });

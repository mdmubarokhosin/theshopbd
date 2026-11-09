#!/usr/bin/env node
/**
 * THE SHOP BD — ক্রস-প্ল্যাটফর্ম Next.js লঞ্চার
 * ─────────────────────────────────────────────────────────────
 * কেন এই ফাইল?
 *   Next.js 16-এর ডিফল্ট বান্ডলার "Turbopack" শুধুমাত্র নেটিভ বাইন্ডিং সহ
 *   প্ল্যাটফর্মে চলে (linux/mac/win)। Android/Termux (android/arm64)-তে
 *   Turbopack-এর নেটিভ বাইন্ডিং নেই — শুধু WASM লোড হয়, ফলে এই এরর আসে:
 *     "Error: Turbopack is not supported on this platform (android/arm64)"
 *
 *   এই লঞ্চার Android/Termux শনাক্ত করলে স্বয়ংক্রিয়ভাবে `--webpack`
 *   ফ্ল্যাগ যোগ করে — তাই ইউজারকে কিছুই করতে হয় না, `npm run dev`
 *   সব প্ল্যাটফর্মে একইভাবে চলে।
 *
 *   জোর করে নির্দিষ্ট বান্ডলার চালাতে চাইলে:
 *     TSB_BUNDLER=webpack npm run dev
 *     TSB_BUNDLER=turbopack npm run dev
 */
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const command = process.argv[2] || 'dev'
const extraArgs = process.argv.slice(3)

// ── ১) বান্ডলার নির্বাচন ──────────────────────────────────────────
const envBundler = String(process.env.TSB_BUNDLER || '').toLowerCase()
const isAndroid =
  process.platform === 'android' ||
  String(process.env.PREFIX || '').includes('com.termux') ||
  String(process.env.TERMUX_VERSION || '').length > 0

let bundlerFlags = []
if (envBundler === 'webpack') {
  bundlerFlags = ['--webpack']
} else if (envBundler === 'turbopack') {
  bundlerFlags = []
} else if (command === 'build') {
  // প্রোডাকশন বিল্ড সবসময় webpack — কারণ:
  // • কিছু হোস্টিং বিল্ড কনটেইনারে (যেমন Hostinger) Turbopack-এর PostCSS/Tailwind
  //   worker প্রসেস ক্র্যাশ করে:
  //     "Failed to write app endpoint /page ... node process exited before we
  //      could connect to it"
  // • বিল্ড ও ডেভেলপমেন্ট (Termux) একই বান্ডলারে চললে আউটপুট হুবহু মেলে
  bundlerFlags = ['--webpack']
} else if (isAndroid && command === 'dev') {
  // Android/Termux → Turbopack অসমর্থিত, webpack ব্যবহার করুন
  bundlerFlags = ['--webpack']
}

// ── ২) node এক্সিকিউটেবল খুঁজে বের করা (bun দিয়ে চালালেও কাজ করবে) ──
function resolveNode() {
  if (process.env.TSB_NODE_PATH) return process.env.TSB_NODE_PATH
  const exe = process.execPath || 'node'
  const base = path.basename(exe)
  if (!process.isBun && base.startsWith('node')) return exe
  // bun দিয়ে চালানো হলে আসল node খুঁজে নিই
  try {
    const found = execSync('command -v node 2>/dev/null || which node 2>/dev/null', {
      encoding: 'utf8',
      shell: '/bin/sh',
    }).trim()
    if (found && fs.existsSync(found)) return found
  } catch {
    /* node না পেলে fallback */
  }
  return exe
}

// ── ৩) Next.js বাইনারি যাচাই ──────────────────────────────────────
const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next')
if (!fs.existsSync(nextBin)) {
  console.error('✗ Next.js পাওয়া যায়নি — আগে "npm install" চালান।')
  process.exit(1)
}

if (bundlerFlags.length) {
  if (command === 'build') {
    console.log(
      'ℹ প্রোডাকশন বিল্ড webpack বান্ডলারে চলছে — হোস্টিং বিল্ড এনভায়রনমেন্টে Turbopack-এর PostCSS worker ক্র্যাশ এড়াতে।'
    )
  } else {
    console.log(
      'ℹ Android/Termux শনাক্ত হয়েছে — এই প্ল্যাটফর্মে Turbopack চলে না, তাই webpack ব্যবহার হচ্ছে।'
    )
  }
  console.log('ℹ প্রথমবার কম্পাইলে একটু সময় লাগতে পারে, ধৈর্য ধরুন।')
}

// ── ৪) Next.js চালু ───────────────────────────────────────────────
const child = spawn(resolveNode(), [nextBin, command, ...bundlerFlags, ...extraArgs], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  shell: false,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code == null ? 0 : code)
})

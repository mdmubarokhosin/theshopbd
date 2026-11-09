/**
 * Brand & payment logo generator — one-off script.
 * Run: bun scripts/gen-logos.ts
 * Writes SVG wordmark logos to public/brands and public/payments.
 */
import { mkdir, writeFile } from 'fs/promises';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function brandSvg(name: string, bg: string, fg: string, sub = ''): string {
  const fontSize = name.length > 10 ? 26 : name.length > 7 ? 30 : 34;
  const subLine = sub
    ? `<text x="200" y="132" font-family="Arial, sans-serif" font-size="15" font-weight="500" fill="${fg}" opacity="0.75" text-anchor="middle" letter-spacing="3">${esc(sub.toUpperCase())}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160" role="img" aria-label="${esc(name)}">
  <rect width="400" height="160" rx="18" fill="${bg}"/>
  <rect x="10" y="10" width="380" height="140" rx="12" fill="none" stroke="${fg}" stroke-opacity="0.25" stroke-width="2"/>
  <text x="200" y="92" font-family="'Segoe UI', Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="${fg}" text-anchor="middle" letter-spacing="1">${esc(name)}</text>
  ${subLine}
</svg>`;
}

const BRANDS: [string, string, string][] = [
  ['Samsung', '#0b1a33', '#ffffff'],
  ['Xiaomi', '#ff6900', '#ffffff'],
  ['Walton', '#006a4e', '#ffffff'],
  ['Symphony', '#7b1fa2', '#ffffff'],
  ['Havit', '#1f6feb', '#ffffff'],
  ['Aarong', '#6d4c2f', '#f5e9d0'],
  ['Sailor', '#0d3b66', '#ffffff'],
  ['Ecstasy', '#212121', '#ffd54f'],
  ['Apex', '#8b1e1e', '#ffffff'],
  ['Bata', '#d81e05', '#ffffff'],
  ['Lotto', '#0a7d33', '#ffffff'],
  ['Vision', '#00838f', '#ffffff'],
  ['RFL', '#e60023', '#ffffff'],
  ['Pran', '#008a2e', '#ffd400'],
  ['Fresh', '#0a9e49', '#ffffff'],
  ['Singer', '#c62828', '#ffffff'],
  ['Kumarika', '#5d1049', '#ffde59'],
  ['Tibet', '#35502f', '#f1e3c3'],
  ['Meril', '#1565c0', '#ffffff'],
  ['Matador', '#b71c1c', '#ffd600'],
  ['Toy Land', '#f57f17', '#ffffff'],
];

function bkash(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="bKash">
  <rect width="320" height="120" rx="14" fill="#ffffff" stroke="#e5e5e5"/>
  <circle cx="52" cy="60" r="26" fill="#E2136E"/>
  <text x="52" y="72" font-family="Arial, sans-serif" font-size="36" font-weight="800" fill="#ffffff" text-anchor="middle">b</text>
  <text x="92" y="72" font-family="'Segoe UI', Arial, sans-serif" font-size="40" font-weight="800" fill="#E2136E">Kash</text>
  <text x="92" y="94" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#E2136E" opacity="0.7">বিকাশ</text>
</svg>`;
}

function nagad(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="Nagad">
  <rect width="320" height="120" rx="14" fill="#ffffff" stroke="#e5e5e5"/>
  <path d="M40 78 C60 30 108 26 128 44 C112 38 74 44 66 78 Z" fill="#ED1C24"/>
  <text x="138" y="72" font-family="'Segoe UI', Arial, sans-serif" font-size="40" font-weight="800" fill="#F47721">Nagad</text>
  <text x="52" y="98" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#F47721" opacity="0.8">নগদ</text>
</svg>`;
}

function rocket(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="Rocket">
  <rect width="320" height="120" rx="14" fill="#ffffff" stroke="#e5e5e5"/>
  <path d="M46 76 C52 46 78 36 96 42 C80 48 68 60 64 78 Z" fill="#F37021"/>
  <circle cx="86" cy="58" r="7" fill="#8C3494"/>
  <text x="106" y="72" font-family="'Segoe UI', Arial, sans-serif" font-size="38" font-weight="800" fill="#8C3494">Rocket</text>
  <text x="106" y="94" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#8C3494" opacity="0.7">DBBL মোবাইল ব্যাংকিং</text>
</svg>`;
}

function visa(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="Visa">
  <rect width="320" height="120" rx="14" fill="#ffffff" stroke="#e5e5e5"/>
  <text x="160" y="78" font-family="Arial, sans-serif" font-size="44" font-weight="800" font-style="italic" fill="#1A1F71" text-anchor="middle" letter-spacing="4">VISA</text>
</svg>`;
}

function mastercard(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="Mastercard">
  <rect width="320" height="120" rx="14" fill="#ffffff" stroke="#e5e5e5"/>
  <circle cx="138" cy="60" r="28" fill="#EB001B"/>
  <circle cx="182" cy="60" r="28" fill="#F79E1B" fill-opacity="0.9"/>
  <path d="M160 38 a28 28 0 0 1 0 44 a28 28 0 0 1 0 -44 Z" fill="#FF5F00"/>
  <text x="160" y="108" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#3a3a3a" text-anchor="middle">Mastercard</text>
</svg>`;
}

function cod(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="Cash on Delivery">
  <rect width="320" height="120" rx="14" fill="#ffffff" stroke="#e5e5e5"/>
  <rect x="46" y="34" width="64" height="52" rx="8" fill="#2e7d32"/>
  <rect x="58" y="46" width="40" height="28" rx="4" fill="#a5d6a7"/>
  <circle cx="78" cy="60" r="9" fill="#2e7d32"/>
  <text x="128" y="58" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#2e7d32">CASH ON</text>
  <text x="128" y="84" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#2e7d32">DELIVERY</text>
</svg>`;
}

const PAYMENTS: [string, () => string][] = [
  ['bkash', bkash],
  ['nagad', nagad],
  ['rocket', rocket],
  ['visa', visa],
  ['mastercard', mastercard],
  ['cod', cod],
];

async function main() {
  await mkdir('public/brands', { recursive: true });
  await mkdir('public/payments', { recursive: true });
  for (const [name, bg, fg] of BRANDS) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await writeFile(`public/brands/${slug}.svg`, brandSvg(name, bg, fg));
  }
  for (const [name, fn] of PAYMENTS) {
    await writeFile(`public/payments/${name}.svg`, fn());
  }
  console.log('Logos generated: 21 brand SVGs + 6 payment SVGs');
}

main();

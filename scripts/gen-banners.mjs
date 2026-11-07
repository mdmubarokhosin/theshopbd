import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const OUT = '/home/z/my-project/public/products';
const BANNERS = [
  ['banner-electronics.png', 'modern tech gadgets flat lay banner, wireless earbuds smartwatch smartphone speaker headphones arranged diagonally on dark blue gradient background, dramatic lighting, wide banner composition, space on left side for text, premium commercial photography'],
  ['banner-fashion.png', 'fashion clothing banner, stylish folded clothes jeans shirts dresses and sneakers arranged on warm beige background with soft shadows, wide banner composition, space on left side for text, premium commercial photography'],
  ['banner-home.png', 'cozy home living banner, ceramic dinner set cushions blanket and vase with flowers on wooden table, warm morning light, wide banner composition, space on left side for text, premium commercial photography'],
  ['banner-market.png', 'multi brand online shopping banner, colorful shopping bags gift boxes and products floating on vibrant gradient background, dynamic composition, wide banner, space on left side for text, premium commercial photography'],
];

async function main() {
  const zai = await ZAI.create();
  const queue = BANNERS.filter(([f]) => !fs.existsSync(`${OUT}/${f}`));
  console.log('to generate:', queue.map((q) => q[0]).join(', '));
  while (queue.length) {
    const [file, prompt] = queue[0];
    try {
      const res = await zai.images.generations.create({ prompt, size: '1344x768' });
      const b64 = res?.data?.[0]?.base64;
      if (!b64) throw new Error('no data');
      fs.writeFileSync(`${OUT}/${file}`, Buffer.from(b64, 'base64'));
      console.log(`[OK] ${file}`);
      queue.shift();
      await new Promise((r) => setTimeout(r, 15000));
    } catch (e) {
      console.error(`[wait] ${file}: ${e.message} — sleeping 45s`);
      await new Promise((r) => setTimeout(r, 45000));
    }
  }
  console.log('ALL BANNERS DONE');
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });

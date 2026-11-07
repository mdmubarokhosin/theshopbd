import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const OUT = '/home/z/my-project/public/products';

const STYLE = 'professional e-commerce product photography, clean studio lighting, pure white background, centered composition, high quality, sharp focus, detailed';

const IMAGES = [
  // Electronics & audio
  ['earbuds.png', `white wireless earbuds with charging case, ${STYLE}`],
  ['speaker.png', `portable bluetooth speaker in dark blue color, cylindrical shape, ${STYLE}`],
  ['powerbank.png', `slim black power bank 20000mAh with digital display showing battery percentage, ${STYLE}`],
  ['smartphone.png', `modern midnight blue smartphone standing upright, triple camera, colorful abstract wallpaper on screen, ${STYLE}`],
  ['smartwatch.png', `black smartwatch with round screen showing fitness stats, silicon strap, ${STYLE}`],
  ['keyboard.png', `white mechanical gaming keyboard with RGB backlit keys, ${STYLE}`],
  ['laptop-stand.png', `aluminum laptop stand with laptop on it, silver color, ${STYLE}`],
  // Fashion men
  ['panjabi.png', `elegant white cotton mens panjabi kurta on invisible mannequin, traditional south asian design, embroidery on collar, ${STYLE}`],
  ['shirt.png', `men's casual checked shirt in navy blue and white, folded neatly, ${STYLE}`],
  ['jeans.png', `men's blue denim jeans folded, classic five pocket style, ${STYLE}`],
  ['hoodie.png', `men's olive green hoodie sweatshirt with kangaroo pocket on invisible mannequin, ${STYLE}`],
  ['tshirt.png', `plain white cotton t-shirt on invisible mannequin, round neck, ${STYLE}`],
  // Fashion women
  ['salwar-kameez.png', `elegant red salwar kameez three piece set for women with dupatta on invisible mannequin, south asian traditional dress, ${STYLE}`],
  ['saree.png', `luxurious green silk saree draped on invisible mannequin with golden border, ${STYLE}`],
  ['kurti.png', `women's printed cotton kurti in teal color on invisible mannequin, ${STYLE}`],
  // Shoes
  ['sneakers.png', `white sports sneakers with red accents, side view pair, ${STYLE}`],
  ['formal-shoes.png', `brown leather formal shoes for men, side view pair, polished, ${STYLE}`],
  // Bags
  ['backpack.png', `black laptop backpack with multiple compartments, front three-quarter view, ${STYLE}`],
  ['handbag.png', `brown leather handbag for women with golden clasp, elegant, ${STYLE}`],
  ['wallet.png', `black leather bifold wallet, front view, ${STYLE}`],
  // Watches
  ['analog-watch.png', `elegant silver analog wrist watch with black leather strap, ${STYLE}`],
  // Home & living
  ['dinner-set.png', `white porcelain dinner set with blue floral pattern, 32 pieces arranged, plates bowls cups, ${STYLE}`],
  ['blanket.png', `soft folded fleece blanket in gray color, stack, ${STYLE}`],
  ['bedsheet.png', `folded cotton bed sheet set with floral print, pillow covers on top, ${STYLE}`],
  ['flask.png', `stainless steel thermos flask water bottle in red color, ${STYLE}`],
  ['mug-set.png', `set of 6 ceramic coffee mugs in pastel colors, ${STYLE}`],
  // Beauty
  ['hair-oil.png', `amber glass bottle of herbal amla hair oil with golden cap, ${STYLE}`],
  ['facewash.png', `green tube of herbal face wash with mint leaves beside it, ${STYLE}`],
  ['perfume.png', `luxury golden perfume bottle with spray cap, ${STYLE}`],
  ['cream-jar.png', `white cosmetic cream jar with silver lid, ${STYLE}`],
  // Sports
  ['football.png', `classic black and white football soccer ball, ${STYLE}`],
  ['yoga-mat.png', `rolled purple yoga mat standing upright, ${STYLE}`],
  ['dumbbell.png', `pair of black rubber coated dumbbells, ${STYLE}`],
  // Baby & toys
  ['baby-romper.png', `cute yellow baby romper onesie folded flat lay, soft cotton, ${STYLE}`],
  ['teddy-bear.png', `large soft brown teddy bear plush toy sitting, ${STYLE}`],
  ['building-blocks.png', `colorful building blocks toy set for kids, scattered arrangement, ${STYLE}`],
  // Books & stationery
  ['notebook.png', `stack of hardcover notebooks with colorful covers, ${STYLE}`],
  ['pen-set.png', `elegant ballpoint pen gift set in presentation box, ${STYLE}`],
  // Grocery
  ['mango-juice.png', `mango fruit juice tetra pack carton box with fresh mangoes beside it, ${STYLE}`],
  ['soyabean-oil.png', `plastic bottle of golden soybean cooking oil 5 liter jug, ${STYLE}`],
  // Banners
  ['banner-electronics.png', `modern tech gadgets flat lay banner, wireless earbuds smartwatch smartphone speaker headphones arranged diagonally on dark blue gradient background, dramatic lighting, wide banner composition, space on left side for text, premium commercial photography`],
  ['banner-fashion.png', `fashion clothing banner, stylish folded clothes jeans shirts dresses and sneakers arranged on warm beige background with soft shadows, wide banner composition, space on left side for text, premium commercial photography`],
  ['banner-home.png', `cozy home living banner, ceramic dinner set cushions blanket and vase with flowers on wooden table, warm morning light, wide banner composition, space on left side for text, premium commercial photography`],
  ['banner-market.png', `multi brand online shopping banner, colorful shopping bags gift boxes and products floating on vibrant gradient background, dynamic composition, wide banner, space on left side for text, premium commercial photography`],
];

async function main() {
  const zai = await ZAI.create();
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  const list = only ? IMAGES.filter(([f]) => only.includes(f.replace('.png', ''))) : IMAGES;

  let done = 0, failed = [];
  const CONCURRENCY = 2;
  const queue = [...list];

  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      const [file, prompt] = item;
      const out = `${OUT}/${file}`;
      if (fs.existsSync(out)) { done++; continue; }
      const size = file.startsWith('banner') ? '1344x768' : '1024x1024';
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const res = await zai.images.generations.create({ prompt, size });
          const b64 = res?.data?.[0]?.base64;
          if (!b64) throw new Error('no data');
          fs.writeFileSync(out, Buffer.from(b64, 'base64'));
          done++;
          console.log(`[OK ${done}/${list.length}] ${file}`);
          await new Promise((r) => setTimeout(r, 2000));
          break;
        } catch (e) {
          console.error(`[RETRY ${attempt}] ${file}: ${e.message}`);
          if (attempt === 5) failed.push(file);
          await new Promise((r) => setTimeout(r, 4000 * attempt));
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`DONE. success=${done} failed=${failed.length} ${failed.join(',')}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });

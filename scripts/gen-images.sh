#!/bin/bash
# Sequential image generation with retry on 429
cd /home/z/my-project/public/products

gen() {
  local prompt="$1"
  local out="$2"
  local size="${3:-1024x1024}"
  if [ -f "$out" ]; then echo "SKIP: $out"; return 0; fi
  for attempt in 1 2 3 4; do
    z-ai image -p "$prompt" -o "$out" -s "$size" > "/tmp/gen_$(basename $out .png).log" 2>&1
    if [ -f "$out" ]; then echo "OK: $out"; sleep 4; return 0; fi
    echo "RETRY($attempt): $out"; sleep $((attempt * 10))
  done
  echo "FAIL: $out"
}

# Products
gen "Professional product photography of pure golden liquid honey in clear glass jar with wooden dipper drizzling honey, clean white background, soft studio lighting, e-commerce product shot" "honey-golden.png"
gen "Professional product photography of dark premium ajwa dates from madina in elegant white bowl, soft dark brown dates, clean white background, soft studio lighting, e-commerce product shot" "dates-ajwa.png"
gen "Professional product photography of premium large jumbo medjool dates arranged in white ceramic bowl, glossy brown dates, clean white background, soft studio lighting, e-commerce product shot" "dates-medjool.png"
gen "Professional product photography of pure cow ghee, golden creamy clarified butter in round glass jar, clean white background, soft studio lighting, e-commerce product shot" "ghee-gawa.png"
gen "Professional product photography of dark amber black seed honey in glass jar, rich texture, clean white background, soft studio lighting, e-commerce product shot" "honey-sundarban.png"
gen "Professional product photography of colorful bangladeshi spice powders masala in wooden spoons and bowls, turmeric red chili cumin, clean white background, top view, e-commerce product shot" "spices-masala.png"
gen "Professional product photography of roasted cumin powder jira in wooden bowl with whole cumin seeds and spoon, clean white background, e-commerce product shot" "spice-cumin.png"
gen "Professional product photography of red chili powder in white bowl with dried red chilies around, clean white background, e-commerce product shot" "spice-chili.png"
gen "Professional product photography of raw cashew nuts in wooden bowl with some scattered, clean white background, soft studio lighting, e-commerce product shot" "nuts-cashew.png"
gen "Professional product photography of walnut kernels and whole walnuts on white marble surface, clean white background, soft studio lighting, e-commerce product shot" "nuts-walnut.png"
gen "Professional product photography of chia seeds in small glass bowl with wooden spoon, clean white background, soft studio lighting, e-commerce product shot" "seeds-chia.png"
gen "Professional product photography of red masoor dal lentils in burlap sack with wooden bowl, clean white background, soft studio lighting, e-commerce product shot" "dal-masoor.png"
gen "Professional product photography of premium white miniket rice grains in jute sack with wooden scoop, clean white background, soft studio lighting, e-commerce product shot" "rice-white.png"
gen "Professional product photography of whole wheat flour in kraft paper bag with wheat ears, brown flour, clean white background, soft studio lighting, e-commerce product shot" "atta-laal.png"
gen "Professional product photography of golden roasted vermicelli semai nests in ceramic bowl, clean white background, soft studio lighting, e-commerce product shot" "semai-lachcha.png"
gen "Professional product photography of dried green tea leaves with a cup of green tea, clean white background, soft studio lighting, e-commerce product shot" "tea-green.png"
gen "Professional product photography of roasted arabica coffee beans in burlap bag with cup of black coffee, clean white background, soft studio lighting, e-commerce product shot" "coffee-beans.png"
gen "Professional product photography of organic beetroot powder in glass jar with fresh beetroot slice, pink powder, clean white background, soft studio lighting, e-commerce product shot" "beetroot-powder.png"
gen "Professional product photography of traditional bangladeshi mango pickle achar in glass jar with mustard oil, clean white background, soft studio lighting, e-commerce product shot" "pickle-mango.png"

# Banners
gen "Beautiful wide banner photography of assorted organic food products, honey jars dates nuts and spices arranged on rustic wooden table, warm natural lighting, no text, no people" "banner-organic.png" 1344x768
gen "Beautiful wide banner photography of golden honey jar with honeycomb and honey drizzler, warm golden tones, dark green background, no text, no people" "banner-honey.png" 1344x768
gen "Beautiful wide banner photography of premium dates medjool and ajwa in elegant arrangement with warm bokeh lights, dark tones, no text, no people" "banner-dates.png" 1344x768
gen "Beautiful wide flat lay photography of bangladeshi organic spices turmeric chili cumin powder in bowls on dark green background, top view, no text" "banner-spices.png" 1344x768

echo "=== ALL DONE ==="

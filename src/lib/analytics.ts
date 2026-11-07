'use client';

/**
 * THE SHOP BD — অ্যানালিটিক্স (Google Analytics 4 + Facebook Pixel)
 * ---------------------------------------------------------------------------
 * • সেটিংস অনুযায়ী স্ক্রিপ্ট লোড হয় (ga4_enabled/ga4_id, fb_pixel_enabled/fb_pixel_id)
 * • GA4 id খালি হলে Firebase measurementId (firebaseConfig.measurementId) ব্যবহার হয়
 * • ই-কমার্স ইভেন্ট: view_item, add_to_cart, view_cart, begin_checkout, purchase, search
 * • FB পিক্সেল ইভেন্ট: ViewContent, AddToCart, InitiateCheckout, Purchase, Search
 */

type AnyWin = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
};

let gaLoaded = false;
let fbLoaded = false;

function gaId(): string | null {
  if (typeof window === 'undefined') return null;
  const s = (window as unknown as { __tsbSettings?: Record<string, string> }).__tsbSettings;
  if (!s) return null;
  if (s.ga4_enabled !== '1') return null;
  const id = (s.ga4_id || '').trim();
  if (id) return id;
  const fbCfg = (window as unknown as { __tsbFirebaseMeasurementId?: string }).__tsbFirebaseMeasurementId;
  return fbCfg || null;
}

function pixelId(): string | null {
  if (typeof window === 'undefined') return null;
  const s = (window as unknown as { __tsbSettings?: Record<string, string> }).__tsbSettings;
  if (!s || s.fb_pixel_enabled !== '1') return null;
  return (s.fb_pixel_id || '').trim() || null;
}

/** সেটিংস হাইড্রেট হলে app-shell থেকে একবার কল হয় — স্ক্রিপ্ট ইনজেক্ট */
export function initAnalytics(settings: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __tsbSettings?: Record<string, string> };
  w.__tsbSettings = settings;

  // GA4
  const gid = gaId();
  if (gid && !gaLoaded) {
    gaLoaded = true;
    const w2 = window as AnyWin;
    w2.dataLayer = w2.dataLayer || [];
    w2.gtag = function gtag(...args: unknown[]) {
      w2.dataLayer!.push(args);
    };
    w2.gtag('js', new Date());
    w2.gtag('config', gid, { send_page_view: true });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${gid}`;
    document.head.appendChild(s);
  }

  // Facebook Pixel
  const pid = pixelId();
  if (pid && !fbLoaded) {
    fbLoaded = true;
    const w3 = window as AnyWin & { _fbq?: unknown };
    if (!w3.fbq) {
      const fbq = function (...args: unknown[]) {
        (fbq as unknown as { queue: unknown[] }).queue.push(args);
      } as AnyWin['fbq'];
      (fbq as unknown as { queue: unknown[] }).queue = [];
      w3.fbq = fbq;
      w3._fbq = fbq;
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(s);
      setTimeout(() => {
        w3.fbq?.('init', pid);
        w3.fbq?.('track', 'PageView');
      }, 0);
    }
  }
}

/** রাউট পরিবর্তনে পেজভিউ */
export function trackPageView(path: string): void {
  if (typeof window === 'undefined') return;
  const w = window as AnyWin;
  const gid = gaId();
  if (gid && w.gtag) w.gtag('event', 'page_view', { page_path: path });
  const pid = pixelId();
  if (pid && w.fbq && (w.fbq as unknown as { loaded?: boolean }).loaded) {
    w.fbq('track', 'PageView');
  }
}

function sendGa(event: string, params: Record<string, unknown>): void {
  const w = window as AnyWin;
  if (gaId() && w.gtag) w.gtag('event', event, params);
}

function sendFb(event: string, params: Record<string, unknown>): void {
  const w = window as AnyWin;
  if (pixelId() && w.fbq) {
    try {
      w.fbq('track', event, params);
    } catch {
      // পিক্সেল এখনো লোড না হলে বাদ
    }
  }
}

export function trackViewItem(p: { id: string; name: string; price: number; category?: string }): void {
  sendGa('view_item', {
    items: [{ item_id: p.id, item_name: p.name, price: p.price, item_category: p.category ?? '' }],
    value: p.price,
    currency: 'BDT',
  });
  sendFb('ViewContent', { content_ids: [p.id], content_name: p.name, content_type: 'product', value: p.price, currency: 'BDT' });
}

export function trackAddToCart(p: { id: string; name: string; price: number; qty: number }): void {
  sendGa('add_to_cart', {
    items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: p.qty }],
    value: p.price * p.qty,
    currency: 'BDT',
  });
  sendFb('AddToCart', { content_ids: [p.id], content_name: p.name, content_type: 'product', value: p.price * p.qty, currency: 'BDT' });
}

export function trackViewCart(value: number): void {
  sendGa('view_cart', { value, currency: 'BDT' });
}

export function trackBeginCheckout(value: number, items: number): void {
  sendGa('begin_checkout', { value, currency: 'BDT', items_count: items });
  sendFb('InitiateCheckout', { value, currency: 'BDT', num_items: items });
}

export function trackSearch(query: string): void {
  sendGa('search', { search_term: query });
  sendFb('Search', { search_string: query });
}

export function trackPurchase(orderNumber: string, value: number, itemNames: string[]): void {
  sendGa('purchase', {
    transaction_id: orderNumber,
    value,
    currency: 'BDT',
    items: itemNames.map((n, i) => ({ item_id: `${orderNumber}-${i}`, item_name: n })),
  });
  sendFb('Purchase', { value, currency: 'BDT', content_type: 'product', contents: itemNames.map((n) => ({ id: n, quantity: 1 })) });
}

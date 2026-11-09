'use client';

/**
 * THE SHOP BD — WhatsApp অর্ডার বাটন ও ফ্লোটিং চ্যাট
 * ---------------------------------------------------------------------------
 * • <WhatsAppFloat/>  — সব পেজে ফ্লোটিং বাটন (অ্যাডমিন সেটিংস নিয়ন্ত্রিত)
 * • waProductLink()   — পণ্য পেজের "WhatsApp-এ অর্ডার করুন" লিংক
 * • waCartLink()      — কার্ট থেকে WhatsApp অর্ডার লিংক
 * টেমপ্লেট ভেরিয়েবল: {site} {product} {price} {url} {qty}
 */

import { useStore } from '@/lib/store';
import { useCartData } from '@/lib/db/hooks';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type WaSettings = {
  enabled: boolean;
  phone: string;
  template: string;
  floatEnabled: boolean;
  position: 'left' | 'right';
  productButton: boolean;
};

function readWaSettings(map: Record<string, string>): WaSettings {
  return {
    enabled: map.wa_enabled === '1',
    phone: (map.wa_phone || '').replace(/\D/g, ''),
    template: map.wa_message_template || 'আসসালামু আলাইকুম! আমি {site}-এ অর্ডার করতে চাই।',
    floatEnabled: map.wa_float_enabled === '1',
    position: map.wa_float_position === 'left' ? 'left' : 'right',
    productButton: map.wa_product_button === '1',
  };
}

/** ফোন নম্বর 8801XXXXXXXXX ফরম্যাটে */
function normPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('880')) return d;
  if (d.startsWith('0')) return `880${d.slice(1)}`;
  return d;
}

function waHref(message: string): string {
  const st = readWaSettings(useStore.getState().siteSettings);
  return `https://wa.me/${normPhone(st.phone)}?text=${encodeURIComponent(message.replace(/\s+/g, ' ').trim())}`;
}

function fillTpl(tpl: string, vars: Record<string, string>): string {
  const site = useStore.getState().siteSettings.site_title || 'THE SHOP BD';
  return tpl
    .replaceAll('{site}', site)
    .replaceAll('{product}', vars.product ?? '')
    .replaceAll('{price}', vars.price ?? '')
    .replaceAll('{qty}', vars.qty ?? '')
    .replaceAll('{url}', vars.url ?? '');
}

/** পণ্য পেজের অর্ডার বাটনের লিংক (null হলে বাটন দেখাবে না) */
export function waProductLink(
  product: { slug: string; name: string; nameBn?: string | null; price: number }
): string | null {
  if (typeof window === 'undefined') return null;
  const st = readWaSettings(useStore.getState().siteSettings);
  if (!st.enabled || !st.phone || !st.productButton) return null;
  const url = `${window.location.origin}/product/${product.slug}`;
  const msg = fillTpl(
    'আসসালামু আলাইকুম! আমি {site} থেকে অর্ডার করতে চাই:\n{product} — মূল্য {price} টাকা\n{url}',
    { product: product.nameBn || product.name, price: String(Math.round(product.price)), url }
  );
  return waHref(msg);
}

/** কার্ট/সাধারণ WhatsApp অর্ডার লিংক (null হলে দেখাবে না) */
export function waGeneralLink(): string | null {
  if (typeof window === 'undefined') return null;
  const st = readWaSettings(useStore.getState().siteSettings);
  if (!st.enabled || !st.phone) return null;
  return waHref(fillTpl(st.template, {}));
}

/** ফ্লোটিং WhatsApp চ্যাট বাটন — AppShell-এ মাউন্ট হয় */
export function WhatsAppFloat({ hidden }: { hidden?: boolean }) {
  const siteSettings = useStore((s) => s.siteSettings);
  const { count } = useCartData();
  const st = readWaSettings(siteSettings);
  if (!st.enabled || !st.phone || !st.floatEnabled || hidden) return null;

  const href = waHref(fillTpl(st.template, {}));
  const side = st.position === 'left' ? 'left-4' : 'right-4';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp-এ অর্ডার করুন"
      className={cn(
        'fixed bottom-20 z-40 flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95 md:bottom-6',
        side
      )}
      style={{ width: 52, height: 52 }}
    >
      <span className="relative">
        <MessageCircle className="h-7 w-7 fill-white" strokeWidth={0} />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold">
            {count > 9 ? '৯+' : count}
          </span>
        )}
      </span>
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366]/30" aria-hidden />
    </a>
  );
}

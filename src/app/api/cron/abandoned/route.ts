/**
 * GET /api/cron/abandoned?secret=... — অ্যাব্যান্ডন্ড কার্ট অটো-রিমাইন্ডার (ক্রন)
 * ---------------------------------------------------------------------------
 * • secret = settings.webhook_secret হতে হবে
 * • যোগ্য কার্ট: status='open' এবং আপডেট হয়ে ac_threshold মিনিট পার হয়েছে,
 *   শেষ রিমাইন্ডার ২৪ ঘণ্টার কম আগে নয়, ফোন নম্বর আছে
 * • প্রতিটার জন্য SMS পাঠায় + webhooks নোডে ইভেন্ট লেখে (ক্লায়েন্ট মার্ক করবে)
 * cron-job.org থেকে ঘণ্টায় একবার কল করলেই চলবে (docs/NEW-FEATURES.md)
 */
import { readSettings, readShop, setting, writeWebhook, jsonError } from '@/lib/server/rtdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CartRec = {
  id?: string;
  phone?: string | null;
  status?: string;
  updatedAt?: string;
  lastRemindedAt?: string | null;
  items?: { name?: string; qty?: number }[];
  subtotal?: number;
};

function normalizeBn(to: string): string {
  const digits = (to || '').replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `880${digits.slice(1)}`;
  return digits;
}

async function sendSms(cfg: Record<string, string>, to: string, message: string): Promise<boolean> {
  // অ্যাডমিন /api/sms/send লজিক পুনঃব্যবহার — সরাসরি প্রোভাইডার কল
  const type = setting(cfg, 'sms_provider_type', 'bulksmsbd');
  const apiUrl = setting(cfg, 'sms_api_url', 'https://bulksmsbd.net/api/apiSend_sms/sendingapi');
  try {
    if (type === 'custom') {
      const tpl = setting(cfg, 'sms_custom_body', 'api_key={apikey}&number={to}&message={message}&senderid={sender}');
      const fill = tpl
        .replaceAll('{apikey}', setting(cfg, 'sms_api_key'))
        .replaceAll('{to}', to)
        .replaceAll('{message}', encodeURIComponent(message))
        .replaceAll('{sender}', setting(cfg, 'sms_sender_id'));
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fill,
      });
      return res.ok;
    }
    // bulksmsbd (ডিফল্ট) ও sslwireless — সংক্ষিপ্ত ফরম
    if (type === 'sslwireless') {
      const res = await fetch(
        setting(cfg, 'sms_api_url', 'https://smsplus.sslwireless.com/api/v3/send-sms'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_token: setting(cfg, 'sms_store_password'),
            sid: setting(cfg, 'sms_store_id'),
            msisdn: to,
            sms_text: message,
            csms_id: `tsb${Date.now()}${Math.floor(Math.random() * 1000)}`,
          }),
        }
      );
      return res.ok;
    }
    const body = new URLSearchParams({
      api_key: setting(cfg, 'sms_api_key'),
      type: 'text',
      number: to,
      senderid: setting(cfg, 'sms_sender_id'),
      message,
    });
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = await res.text();
    return text.includes('202');
  } catch {
    return false;
  }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const cfg = await readSettings();
  const hookSecret = setting(cfg, 'webhook_secret', 'tsb-hook-change-me');
  if (!secret || secret !== hookSecret) return jsonError('অননুমোদিত (secret ভুল)', 401);
  if (setting(cfg, 'ac_enabled', '0') !== '1') return Response.json({ ok: true, sent: 0, skipped: 'অ্যাব্যান্ডন্ড কার্ট রিমাইন্ডার বন্ধ' });
  if (setting(cfg, 'sms_enabled', '0') !== '1') return Response.json({ ok: true, sent: 0, skipped: 'SMS বন্ধ' });

  const thresholdMin = Number(setting(cfg, 'ac_threshold', '60')) || 60;
  const tpl = setting(cfg, 'sms_tpl_abandoned', 'আপনার কার্টে {count} টি পণ্য অপেক্ষা করছে! এখনই অর্ডার সম্পূর্ণ করুন {site} {offer}');
  const site = setting(cfg, 'site_title', 'THE SHOP BD');
  const offer = setting(cfg, 'ac_offer_text', '');

  const carts = await readShop<Record<string, CartRec>>('abandonedCarts');
  if (!carts || typeof carts !== 'object') return Response.json({ ok: true, sent: 0 });

  const now = Date.now();
  let sent = 0;
  for (const cart of Object.values(carts)) {
    if (!cart || cart.status !== 'open') continue;
    const phone = normalizeBn(String(cart.phone || ''));
    if (!/^8801[3-9]\d{8}$/.test(phone)) continue;
    const updated = cart.updatedAt ? Date.parse(cart.updatedAt) : 0;
    if (!updated || now - updated < thresholdMin * 60_000) continue;
    const last = cart.lastRemindedAt ? Date.parse(cart.lastRemindedAt) : 0;
    if (last && now - last < 24 * 3600_000) continue;

    const count = (cart.items || []).reduce((n, i) => n + (i.qty || 0), 0);
    const text = tpl
      .replaceAll('{count}', String(count))
      .replaceAll('{subtotal}', String(cart.subtotal ?? ''))
      .replaceAll('{offer}', offer)
      .replaceAll('{site}', site)
      .replace(/\s+/g, ' ')
      .trim();
    const ok = await sendSms(cfg, phone, text);
    await writeWebhook({
      type: 'ac_reminded',
      secret: hookSecret,
      cartId: cart.id ?? null,
      smsOk: ok,
      to: phone,
      message: text,
      template: 'abandoned',
    });
    if (ok) sent++;
  }
  return Response.json({ ok: true, sent, checkedAt: new Date().toISOString() });
}

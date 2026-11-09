/**
 * POST /api/pay/bkash/create — bKash Tokenized Checkout: পেমেন্ট তৈরি
 * ---------------------------------------------------------------------------
 * Body: { orderNumber }
 * ফল: { ok, paymentID, bkashURL } — ব্রাউজার bkashURL-এ রিডাইরেক্ট করবে।
 * ক্রেডেনশিয়াল RTDB সেটিংস থেকে সার্ভারেই পড়া হয়।
 */
import { readSettings, setting, readShop, requestOrigin, jsonError } from '@/lib/server/rtdb';
import { grantToken, bkashBase } from '@/lib/server/bkash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRec = { orderNumber?: string; total?: number; phone?: string; customerName?: string };

export async function POST(req: Request): Promise<Response> {
  const cfg = await readSettings();
  if (setting(cfg, 'bkash_enabled', '0') !== '1') return jsonError('bKash গেটওয়ে বন্ধ আছে (অ্যাডমিন প্যানেল)');

  let body: { orderNumber?: string };
  try {
    body = (await req.json()) as { orderNumber?: string };
  } catch {
    return jsonError('অবৈধ রিকোয়েস্ট');
  }
  const orderNumber = String(body.orderNumber || '');
  if (!orderNumber) return jsonError('অর্ডার নম্বর দিন');

  const orders = await readShop<Record<string, OrderRec>>('orders');
  let order: OrderRec | null = null;
  if (orders && typeof orders === 'object') {
    for (const v of Object.values(orders)) {
      if (v && v.orderNumber === orderNumber) { order = v; break; }
    }
  }
  if (!order || typeof order.total !== 'number') return jsonError('অর্ডার পাওয়া যায়নি');

  const grant = await grantToken(cfg);
  if (!grant.ok || !grant.token) return jsonError(grant.error || 'bKash টোকেন ব্যর্থ');

  const base = bkashBase(setting(cfg, 'bkash_mode', 'sandbox'));
  const origin = requestOrigin(req);
  try {
    const res = await fetch(`${base}/tokenized/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: grant.token,
        'X-App-Key': setting(cfg, 'bkash_app_key'),
      },
      body: JSON.stringify({
        mode: '0011',
        payerReference: order.phone || 'customer',
        callbackURL: `${origin}/pay/bkash-return?order=${encodeURIComponent(orderNumber)}`,
        amount: String(order.total),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: orderNumber,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { paymentID?: string; bkashURL?: string; statusMessage?: string } | null;
    if (!res.ok || !data?.paymentID || !data?.bkashURL) {
      return jsonError(data?.statusMessage || 'bKash পেমেন্ট তৈরি ব্যর্থ');
    }
    return Response.json({ ok: true, paymentID: data.paymentID, bkashURL: data.bkashURL });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'bKash সংযোগ ব্যর্থ');
  }
}

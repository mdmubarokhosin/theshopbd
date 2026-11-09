/**
 * POST /api/pay/sslcz/init — SSLCommerz হোস্টেড চেকআউট সেশন তৈরি
 * ---------------------------------------------------------------------------
 * Body: { orderNumber }
 * ফল: { ok, gatewayURL } — ব্রাউজার GatewayPageURL-এ রিডাইরেক্ট করবে।
 */
import { readSettings, setting, readShop, requestOrigin, jsonError } from '@/lib/server/rtdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRec = {
  orderNumber?: string;
  total?: number;
  phone?: string;
  customerName?: string;
  email?: string | null;
  address?: string;
  city?: string;
  district?: string;
};

export async function POST(req: Request): Promise<Response> {
  const cfg = await readSettings();
  if (setting(cfg, 'sslcz_enabled', '0') !== '1') return jsonError('SSLCommerz গেটওয়ে বন্ধ আছে (অ্যাডমিন প্যানেল)');
  const storeId = setting(cfg, 'sslcz_store_id');
  const storePass = setting(cfg, 'sslcz_store_passwd');
  if (!storeId || !storePass) return jsonError('SSLCommerz Store ID / Password সেট করা হয়নি');

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

  const sandbox = setting(cfg, 'sslcz_mode', 'sandbox') !== 'live';
  const sessionUrl = sandbox
    ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
    : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';
  const origin = requestOrigin(req);
  const back = (s: string) => `${origin}/pay/sslcz-return?status=${s}&order=${encodeURIComponent(orderNumber)}`;

  const form = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePass,
    total_amount: String(order.total),
    currency: setting(cfg, 'sslcz_currency', 'BDT'),
    tran_id: orderNumber,
    success_url: back('success'),
    fail_url: back('fail'),
    cancel_url: back('cancel'),
    ipn_url: back('ipn'),
    shipping_method: 'Courier',
    product_name: `Order ${orderNumber}`,
    product_category: 'General',
    product_profile: 'general',
    cus_name: order.customerName || 'Customer',
    cus_email: order.email || 'customer@theshopbd.com',
    cus_add1: order.address || '',
    cus_add2: order.city || '',
    cus_city: order.city || '',
    cus_state: order.district || '',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: order.phone || '',
    ship_name: order.customerName || 'Customer',
    ship_add1: order.address || '',
    ship_city: order.city || '',
    ship_state: order.district || '',
    ship_postcode: '1000',
    ship_country: 'Bangladesh',
    emi_option: '0',
  });

  try {
    const res = await fetch(sessionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => null)) as
      | { status?: string; GatewayPageURL?: string; failedreason?: string } | null;
    if (!data?.GatewayPageURL) {
      return jsonError(data?.failedreason || 'SSLCommerz সেশন তৈরি ব্যর্থ');
    }
    return Response.json({ ok: true, gatewayURL: data.GatewayPageURL });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'SSLCommerz সংযোগ ব্যর্থ');
  }
}

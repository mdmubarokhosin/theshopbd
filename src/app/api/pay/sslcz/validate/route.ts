/**
 * POST /api/pay/sslcz/validate — SSLCommerz পেমেন্ট ভ্যালিডেশন (কলব্যাক পেজ থেকে)
 * ---------------------------------------------------------------------------
 * Body: { val_id, orderNumber }
 * ফল: { ok, valid, amount?, tran_id?, status? } — ক্লায়েন্ট যাচাই করে অর্ডার PAID করে।
 */
import { readSettings, setting, readShop, jsonError } from '@/lib/server/rtdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRec = { orderNumber?: string; total?: number };

export async function POST(req: Request): Promise<Response> {
  const cfg = await readSettings();
  if (setting(cfg, 'sslcz_enabled', '0') !== '1') return jsonError('SSLCommerz গেটওয়ে বন্ধ আছে');

  let body: { val_id?: string; orderNumber?: string };
  try {
    body = (await req.json()) as { val_id?: string; orderNumber?: string };
  } catch {
    return jsonError('অবৈধ রিকোয়েস্ট');
  }
  const valId = String(body.val_id || '');
  const orderNumber = String(body.orderNumber || '');
  if (!valId || !orderNumber) return jsonError('val_id / orderNumber নেই');

  // অর্ডারের প্রত্যাশিত মূল্য
  const orders = await readShop<Record<string, OrderRec>>('orders');
  let expected = 0;
  if (orders && typeof orders === 'object') {
    for (const v of Object.values(orders)) {
      if (v && v.orderNumber === orderNumber) { expected = Number(v.total ?? 0); break; }
    }
  }
  if (expected <= 0) return jsonError('অর্ডার পাওয়া যায়নি');

  const sandbox = setting(cfg, 'sslcz_mode', 'sandbox') !== 'live';
  const base = sandbox
    ? 'https://sandbox.sslcommerz.com'
    : 'https://securepay.sslcommerz.com';
  const url =
    `${base}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}` +
    `&store_id=${encodeURIComponent(setting(cfg, 'sslcz_store_id'))}` +
    `&store_passwd=${encodeURIComponent(setting(cfg, 'sslcz_store_passwd'))}&format=json`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = (await res.json().catch(() => null)) as
      | { status?: string; amount?: string | number; tran_id?: string; currency?: string } | null;
    const valid =
      !!data &&
      (data.status === 'VALID' || data.status === 'VALIDATED') &&
      Number(data.amount ?? 0) >= expected &&
      data.tran_id === orderNumber;
    return Response.json({
      ok: true,
      valid,
      amount: data?.amount ? Number(data.amount) : null,
      tran_id: data?.tran_id ?? null,
      status: data?.status ?? null,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'SSLCommerz ভ্যালিডেশন ব্যর্থ');
  }
}

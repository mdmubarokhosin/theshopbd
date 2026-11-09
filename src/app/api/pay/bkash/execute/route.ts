/**
 * POST /api/pay/bkash/execute — bKash পেমেন্ট এক্সিকিউট (কলব্যাক পেজ থেকে)
 * ---------------------------------------------------------------------------
 * Body: { paymentID, orderNumber }
 * ফল: { ok, completed, trxID?, statusMessage? }
 */
import { readSettings, setting, jsonError } from '@/lib/server/rtdb';
import { grantToken, bkashBase } from '@/lib/server/bkash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const cfg = await readSettings();
  if (setting(cfg, 'bkash_enabled', '0') !== '1') return jsonError('bKash গেটওয়ে বন্ধ আছে');

  let body: { paymentID?: string; orderNumber?: string };
  try {
    body = (await req.json()) as { paymentID?: string; orderNumber?: string };
  } catch {
    return jsonError('অবৈধ রিকোয়েস্ট');
  }
  const paymentID = String(body.paymentID || '');
  if (!paymentID) return jsonError('paymentID নেই');

  const grant = await grantToken(cfg);
  if (!grant.ok || !grant.token) return jsonError(grant.error || 'bKash টোকেন ব্যর্থ');

  const base =
    setting(cfg, 'bkash_mode', 'sandbox') === 'live'
      ? 'https://tokenized.pay.bka.sh/v1.2.0-beta'
      : 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';

  try {
    const res = await fetch(`${base}/tokenized/checkout/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: grant.token,
        'X-App-Key': setting(cfg, 'bkash_app_key'),
      },
      body: JSON.stringify({ paymentID }),
    });
    const data = (await res.json().catch(() => null)) as
      | { transactionStatus?: string; trxID?: string; statusMessage?: string } | null;
    const completed = data?.transactionStatus === 'Completed';
    return Response.json({
      ok: res.ok && !!data,
      completed,
      trxID: data?.trxID ?? null,
      statusMessage: data?.statusMessage ?? (res.ok ? null : 'এক্সিকিউট ব্যর্থ'),
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'bKash সংযোগ ব্যর্থ');
  }
}

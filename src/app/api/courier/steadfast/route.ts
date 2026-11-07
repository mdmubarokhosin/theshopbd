/**
 * Steadfast কুরিয়ার API প্রক্সি
 * ---------------------------------------------------------------------------
 * POST /api/courier/steadfast          → কনসাইনমেন্ট তৈরি
 * GET  /api/courier/steadfast?action=balance → ব্যালেন্স
 * API কী/সিক্রেট RTDB সেটিংস থেকে সার্ভারেই পড়া হয় — ব্রাউজারে ফাঁস না।
 */
import { readSettings, setting, jsonError } from '@/lib/server/rtdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SteadfastPayload = {
  invoice?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  cod_amount?: number | string;
  note?: string;
};

function authHeader(cfg: Record<string, string>): string | null {
  const key = setting(cfg, 'sf_api_key');
  const secret = setting(cfg, 'sf_secret_key');
  if (!key || !secret) return null;
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

export async function POST(req: Request): Promise<Response> {
  const cfg = await readSettings();
  if (setting(cfg, 'sf_enabled', '0') !== '1') return jsonError('Steadfast ইন্টিগ্রেশন বন্ধ আছে (অ্যাডমিন প্যানেল)');
  const auth = authHeader(cfg);
  if (!auth) return jsonError('Steadfast API কী / সিক্রেট সেট করা হয়নি');

  let payload: SteadfastPayload;
  try {
    payload = (await req.json()) as SteadfastPayload;
  } catch {
    return jsonError('অবৈধ রিকোয়েস্ট');
  }
  if (!payload.invoice || !payload.recipient_name || !payload.recipient_phone || !payload.recipient_address) {
    return jsonError('অর্ডারের তথ্য অসম্পূর্ণ');
  }

  const base = setting(cfg, 'sf_api_url', 'https://portal.steadfast.com.bd/api/v1').replace(/\/$/, '');
  const body = new URLSearchParams({
    invoice: payload.invoice,
    recipient_name: payload.recipient_name,
    recipient_phone: payload.recipient_phone,
    recipient_address: payload.recipient_address,
    cod_amount: String(payload.cod_amount ?? 0),
    note: payload.note || '',
  });

  try {
    const res = await fetch(`${base}/create_consignment`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });
    const data = (await res.json().catch(() => null)) as
      | { consignment_id?: string; tracking_code?: string; status?: string; message?: string }
      | null;
    if (!res.ok || !data || data.status === 'error' || !data.consignment_id) {
      return Response.json({
        ok: false,
        error: data?.message || `Steadfast রেসপন্স ${res.status}`,
      });
    }
    return Response.json({
      ok: true,
      consignment_id: data.consignment_id,
      tracking_code: data.tracking_code ?? null,
      status: data.status ?? 'in_review',
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Steadfast সংযোগ ব্যর্থ');
  }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.searchParams.get('action') !== 'balance') return jsonError('অজানা action');
  const cfg = await readSettings();
  if (setting(cfg, 'sf_enabled', '0') !== '1') return jsonError('Steadfast ইন্টিগ্রেশন বন্ধ আছে');
  const auth = authHeader(cfg);
  if (!auth) return jsonError('Steadfast API কী / সিক্রেট সেট করা হয়নি');
  const base = setting(cfg, 'sf_api_url', 'https://portal.steadfast.com.bd/api/v1').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/get_balance`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    const data = (await res.json().catch(() => null)) as { status?: string; balance?: string | number } | null;
    if (!res.ok || !data || data.status !== 'success') {
      return Response.json({ ok: false, error: 'ব্যালেন্স আনা যায়নি' });
    }
    return Response.json({ ok: true, balance: Number(data.balance ?? 0) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Steadfast সংযোগ ব্যর্থ');
  }
}

/**
 * POST /api/sms/send — SMS পাঠানো (Bulk SMS BD / SSL Wireless / কাস্টম প্রোভাইডার)
 * ---------------------------------------------------------------------------
 * • প্রোভাইডার কনফিগ RTDB (shop/settings) থেকে সার্ভারেই পড়া হয় — ব্রাউজারে যায় না
 * • Body: { to: '8801XXXXXXXXX', message: '...' }
 * • ফল: { ok: true } বা { ok: false, error }
 * • হালকা রেট-লিমিট: একই নম্বরে মিনিটে ৬টির বেশি SMS গেলে ব্লক (স্প্যাম রক্ষা)
 */
import { readSettings, setting, jsonError } from '@/lib/server/rtdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// সাধারণ ইন-মেমরি রেট লিমিট (সার্ভার রিস্টার্টে রিসেট — যথেষ্ট)
const hits = new Map<string, number[]>();
function rateLimited(phone: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const arr = (hits.get(phone) || []).filter((t) => now - t < window);
  if (arr.length >= 6) return true;
  arr.push(now);
  hits.set(phone, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

/** নম্বর 8801XXXXXXXXX ফরম্যাটে নরমালাইজ */
function normalizeBn(to: string): string {
  const digits = to.replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `880${digits.slice(1)}`;
  return digits;
}

async function sendViaBulkSmsBd(cfg: Record<string, string>, to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const apiUrl = setting(cfg, 'sms_api_url', 'https://bulksmsbd.net/api/apiSend_sms/sendingapi');
  const apiKey = setting(cfg, 'sms_api_key');
  if (!apiKey) return { ok: false, error: 'Bulk SMS BD API কী সেট করা হয়নি' };
  const body = new URLSearchParams({
    api_key: apiKey,
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
  try {
    const data = JSON.parse(text) as { response_code?: number; success_message?: string; error_message?: string };
    if (data.response_code === 202) return { ok: true };
    return { ok: false, error: data.error_message || `প্রোভাইডার রেসপন্স: ${text.slice(0, 140)}` };
  } catch {
    return { ok: false, error: `প্রোভাইডার রেসপন্স: ${text.slice(0, 140)}` };
  }
}

async function sendViaSslWireless(cfg: Record<string, string>, to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const apiUrl = setting(cfg, 'sms_api_url', 'https://smsplus.sslwireless.com/api/v3/send-sms');
  const apiToken = setting(cfg, 'sms_store_password'); // SSL Wireless: api_token = store password
  const sid = setting(cfg, 'sms_store_id');
  if (!apiToken || !sid) return { ok: false, error: 'SSL Wireless Store ID / Password সেট করা হয়নি' };
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_token: apiToken,
      sid,
      msisdn: to,
      sms_text: message,
      csms_id: `tsb${Date.now()}${Math.floor(Math.random() * 1000)}`,
    }),
  });
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { smsinfo?: { sms_id?: string }[]; error_message?: string };
    if (data.smsinfo?.[0]?.sms_id) return { ok: true };
    return { ok: false, error: data.error_message || `প্রোভাইডার রেসপন্স: ${text.slice(0, 140)}` };
  } catch {
    return { ok: false, error: `প্রোভাইডার রেসপন্স: ${text.slice(0, 140)}` };
  }
}

async function sendViaCustom(cfg: Record<string, string>, to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const apiUrl = setting(cfg, 'sms_api_url');
  if (!apiUrl) return { ok: false, error: 'কাস্টম প্রোভাইডারের API URL দিন' };
  const tpl = setting(cfg, 'sms_custom_body', 'api_key={apikey}&number={to}&message={message}&senderid={sender}');
  const fill = tpl
    .replaceAll('{apikey}', setting(cfg, 'sms_api_key'))
    .replaceAll('{to}', to)
    .replaceAll('{message}', encodeURIComponent(message))
    .replaceAll('{sender}', setting(cfg, 'sms_sender_id'))
    .replaceAll('{storeid}', setting(cfg, 'sms_store_id'))
    .replaceAll('{storepass}', setting(cfg, 'sms_store_password'));
  const method = setting(cfg, 'sms_custom_method', 'POST').toUpperCase();
  const isJson = fill.trimStart().startsWith('{');
  const url = method === 'GET' ? `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${fill}` : apiUrl;
  const res = await fetch(url, {
    method: method === 'GET' ? 'GET' : 'POST',
    headers: isJson
      ? { 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : fill,
  });
  const text = await res.text();
  const lower = text.toLowerCase();
  if (res.ok && !lower.includes('error') && !lower.includes('fail')) return { ok: true };
  return { ok: false, error: `প্রোভাইডার রেসপন্স: ${text.slice(0, 140)}` };
}

export async function POST(req: Request): Promise<Response> {
  let body: { to?: string; message?: string };
  try {
    body = (await req.json()) as { to?: string; message?: string };
  } catch {
    return jsonError('অবৈধ রিকোয়েস্ট');
  }
  const to = normalizeBn(String(body.to || ''));
  const message = String(body.message || '').slice(0, 600);
  if (!/^8801[3-9]\d{8}$/.test(to)) return jsonError('সঠিক মোবাইল নম্বর দিন (8801XXXXXXXXX)');
  if (!message.trim()) return jsonError('মেসেজ খালি');
  if (rateLimited(to)) return jsonError('এই নম্বরে খুব দ্রুত একাধিক SMS — এক মিনিট পরে চেষ্টা করুন', 429);

  const cfg = await readSettings();
  if (setting(cfg, 'sms_enabled', '0') !== '1') return jsonError('SMS সিস্টেম বন্ধ আছে (অ্যাডমিন প্যানেল)', 400);

  const type = setting(cfg, 'sms_provider_type', 'bulksmsbd');
  try {
    let result: { ok: boolean; error?: string };
    if (type === 'sslwireless') result = await sendViaSslWireless(cfg, to, message);
    else if (type === 'custom') result = await sendViaCustom(cfg, to, message);
    else result = await sendViaBulkSmsBd(cfg, to, message);
    return Response.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'SMS গেটওয়ে সংযোগ ব্যর্থ');
  }
}

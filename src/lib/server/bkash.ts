/**
 * bKash Tokenized Checkout — সার্ভার-সাইড হেল্পার (API routes ব্যবহার করে)
 */
import { setting } from './rtdb';

/** গ্রান্ট টোকেন (প্রতি রিকোয়েস্টে নতুন — সার্ভারলেস ফ্রেন্ডলি) */
export async function grantToken(cfg: Record<string, string>): Promise<{ ok: boolean; token?: string; error?: string }> {
  const base = bkashBase(setting(cfg, 'bkash_mode', 'sandbox'));
  const username = setting(cfg, 'bkash_username');
  const password = setting(cfg, 'bkash_password');
  const appKey = setting(cfg, 'bkash_app_key');
  const appSecret = setting(cfg, 'bkash_app_secret');
  if (!username || !password || !appKey || !appSecret) {
    return { ok: false, error: 'bKash ক্রেডেনশিয়াল সম্পূর্ণ নয় (username/password/app_key/app_secret)' };
  }
  const res = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      username,
      password,
    },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
  });
  const data = (await res.json().catch(() => null)) as { id_token?: string; statusMessage?: string } | null;
  if (!res.ok || !data?.id_token) {
    return { ok: false, error: data?.statusMessage || 'bKash টোকেন গ্রান্ট ব্যর্থ' };
  }
  return { ok: true, token: data.id_token };
}

export function bkashBase(mode: string): string {
  return mode === 'live'
    ? 'https://tokenized.pay.bka.sh/v1.2.0-beta'
    : 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
}

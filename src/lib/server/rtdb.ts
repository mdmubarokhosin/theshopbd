/**
 * THE SHOP BD — সার্ভার-সাইড RTDB REST হেল্পার (API routes ব্যবহার করে)
 * ---------------------------------------------------------------------------
 * ক্লায়েন্ট SDK সার্ভারে চলে না, তাই সেটিংস/ডেটা RTDB REST API দিয়ে পড়া হয়।
 * সার্ভার সরাসরি `shop` ট্রিতে লেখে না (ক্লায়েন্ট ফুল-ট্রি push ওভাররাইট করবে) —
 * সার্ভার ইভেন্ট `webhooks` সাব-ট্রিতে লেখে, ক্লায়েন্ট WebhookProcessor সেটা প্রসেস করে।
 */
import { firebaseConfig } from '@/lib/firebase/app';

const DB_URL = (firebaseConfig.databaseURL || '').replace(/\/$/, '');

type AnyRec = Record<string, unknown>;

/** shop নোডের যেকোনো পাথ JSON হিসেবে পড়ুন (যেমন 'settings', 'orders') */
export async function readShop<T = unknown>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${DB_URL}/shop/${path}.json`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** settings ম্যাপ (মিসিং কী থাকলে খালি স্ট্রিং) */
export async function readSettings(): Promise<Record<string, string>> {
  const raw = await readShop<AnyRec>('settings');
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (v != null && typeof v !== 'object') out[k] = String(v);
    }
  }
  return out;
}

export function setting(map: Record<string, string>, key: string, fallback = ''): string {
  const v = map[key];
  return typeof v === 'string' && v.length ? v : fallback;
}

/** সার্ভার ইভেন্ট → webhooks নোড (ক্লায়েন্ট প্রসেস করবে) */
export async function writeWebhook(event: AnyRec): Promise<boolean> {
  try {
    const res = await fetch(`${DB_URL}/webhooks.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, at: Date.now(), processed: false }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** রিকোয়েস্টের অরিজিন (কলব্যাক URL বানাতে) */
export function requestOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  const h = req.headers;
  const proto = h.get('x-forwarded-proto') || 'http';
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

/** সাধারণ JSON এরর রেসপন্স */
export function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

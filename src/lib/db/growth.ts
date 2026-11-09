'use client';

/**
 * THE SHOP BD — গ্রোথ ও ইন্টিগ্রেশন সার্ভিস লেয়ার (v6)
 * ---------------------------------------------------------------------------
 * এই ফাইলে সব নতুন ফিচারের ডেটা-লজিক:
 *   • লয়ালটি পয়েন্ট   (অর্জন / খরচ / ব্যালেন্স / অ্যাডমিন সমন্বয়)
 *   • রেফারেল কমিশন   (কোড, ক্রেডিট, উইথড্র)
 *   • অ্যাব্যান্ডন্ড কার্ট (ট্র্যাকিং, রিমাইন্ডার)
 *   • SMS              (টেমপ্লেট ফিল + /api/sms/send কল + লগ)
 *   • কুরিয়ার          (Steadfast কনসাইনমেন্ট)
 *   • পুশ টোকেন        (FCM টোকেন রেজিস্ট্রি)
 * সব রাইট লোকাল db-তে — cloud.ts নিজেই RTDB-তে সিঙ্ক করে।
 */
import { db, uid } from './core';
import { getCurrentUser, cartKeyFor } from './auth';
import type {
  AbandonedCart, LoyaltyEntry, Order, OrderStatus, ReferralEvent, ReferralWithdraw,
  SmsLog, User,
} from './types';
import { getCart } from './services';

/** অর্ডার স্ট্যাটাসের বাংলা নাম — services.ts-এ সংজ্ঞায়িত (রাউন্ড-ইমপোর্ট এড়াতে নিজেই রাখা) */
const STATUS_BN: Record<string, string> = {
  PENDING: 'পেন্ডিং', CONFIRMED: 'কনফার্মড', PROCESSING: 'প্রসেসিং', PACKED: 'প্যাকড',
  SHIPPED: 'শিপড', OUT_FOR_DELIVERY: 'ডেলিভারিতে', DELIVERED: 'ডেলিভার্ড',
  CANCELLED: 'বাতিল', FAILED_DELIVERY: 'ডেলিভারি ব্যর্থ', RETURNED: 'ফেরত', REFUNDED: 'রিফান্ডেড',
};

const SITE_NAME_FALLBACK = 'THE SHOP BD';

function s(key: string, fallback = ''): string {
  const v = (db.get().settings as unknown as Record<string, string>)[key];
  return typeof v === 'string' && v.length ? v : fallback;
}
function enabled(key: string): boolean {
  return s(key, '0') === '1';
}
function siteName(): string {
  return s('site_title', SITE_NAME_FALLBACK) || SITE_NAME_FALLBACK;
}

// ═══════════════════════════ লয়ালটি পয়েন্ট ═══════════════════════════

export function loyaltyBalanceOf(userId: string | null | undefined): number {
  if (!userId) return 0;
  return db
    .collection('loyaltyLedger')
    .filter((e) => e.userId === userId)
    .reduce((sum, e) => sum + e.points, 0);
}

/** প্রতি ১০০৳-এ কত পয়েন্ট অর্জন হবে সেটিং থেকে */
export function loyaltyEarnForAmount(amount: number): number {
  const rate = Number(s('loyalty_earn_rate', '1')) || 0;
  return Math.floor((amount / 100) * rate);
}

/** ১ পয়েন্টের টাকা-মান */
export function loyaltyPointValue(): number {
  return Number(s('loyalty_point_value', '1')) || 0;
}

/**
 * চেকআউটে পয়েন্ট খরচের সর্বোচ্চ সীমা হিসাব:
 * min(ব্যালেন্স, (payable × maxPercent) ÷ pointValue)
 */
export function loyaltyMaxRedeemPoints(payable: number): number {
  const maxPct = Number(s('loyalty_max_percent', '50')) || 0;
  const val = loyaltyPointValue();
  if (val <= 0) return 0;
  const byPercent = Math.floor(((payable * maxPct) / 100) / val);
  return Math.max(0, byPercent);
}

function pushLedger(entry: Omit<LoyaltyEntry, 'id' | 'createdAt'>): void {
  db.append('loyaltyLedger', { ...entry, id: uid('lyl'), createdAt: new Date().toISOString() });
}

/**
 * অর্ডার DELIVERED হলে পয়েন্ট অর্জন (একবারই — order.loyaltyAwarded ফ্ল্যাগ)
 * updateOrderStatus থেকে কল হয়।
 */
export function awardLoyaltyForOrder(order: Order): { points: number } | null {
  if (!enabled('loyalty_enabled')) return null;
  if (!order.userId) return null; // গেস্ট অর্ডারে পয়েন্ট নেই
  const user = db.findById('users', order.userId);
  if (!user || user.roleId === 'super_admin') return null;
  const points = loyaltyEarnForAmount(Math.max(0, order.subtotal - order.discount));
  if (points <= 0) return null;
  pushLedger({
    userId: order.userId,
    userName: user.name,
    type: 'earn',
    points,
    reason: `অর্ডার ডেলিভারি সম্পন্ন (${order.orderNumber})`,
    orderNumber: order.orderNumber,
  });
  return { points };
}

/** চেকআউটে পয়েন্ট খরচ (placeOrder থেকে কল হয় — অর্ডার সফল হলে) */
export function redeemLoyalty(user: User, points: number, orderNumber: string): void {
  if (!enabled('loyalty_enabled') || points <= 0) return;
  const balance = loyaltyBalanceOf(user.id);
  const use = Math.min(points, balance);
  if (use <= 0) return;
  pushLedger({
    userId: user.id,
    userName: user.name,
    type: 'redeem',
    points: -use,
    reason: `অর্ডারে ছাড় (${orderNumber})`,
    orderNumber,
  });
}

/** অ্যাডমিন ম্যানুয়াল সমন্বয় (+/-) */
export function adjustLoyalty(userId: string, points: number, reason: string): boolean {
  const user = db.findById('users', userId);
  if (!user) return false;
  const balance = loyaltyBalanceOf(userId);
  if (points < 0 && balance + points < 0) return false;
  pushLedger({
    userId,
    userName: user.name,
    type: 'adjust',
    points,
    reason: reason || 'অ্যাডমিন সমন্বয়',
    orderNumber: null,
  });
  return true;
}

// ═══════════════════════════ রেফারেল কমিশন ═══════════════════════════

export function generateRefCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `TSB-${code}`;
}

/** ইউজারের রেফারেল কোড — না থাকলে তৈরি করে সেভ (unique) */
export function ensureRefCode(user: User): string {
  if (user.refCode) return user.refCode;
  const existing = new Set(
    db.collection('users').map((u) => u.refCode).filter(Boolean) as string[]
  );
  let code = generateRefCode();
  while (existing.has(code)) code = generateRefCode();
  db.put('users', { ...user, refCode: code });
  return code;
}

export function findUserByRefCode(code: string): User | null {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  return db.collection('users').find((u) => (u.refCode || '').toUpperCase() === c) ?? null;
}

export function referralBalanceOf(userId: string): number {
  return db
    .collection('referralEvents')
    .filter((e) => e.referrerUserId === userId && e.status === 'APPROVED')
    .reduce((sum, e) => sum + e.commission, 0)
    - db
        .collection('referralWithdraws')
        .filter((w) => w.userId === userId && w.status !== 'REJECTED')
        .reduce((sum, w) => sum + w.amount, 0);
}

/**
 * অর্ডার DELIVERED হলে রেফারারকে কমিশন (একবারই — order.referralCredited ফ্ল্যাগ)
 */
export function creditReferralForOrder(order: Order): { commission: number; referrerId: string } | null {
  if (!enabled('referral_enabled')) return null;
  if (!order.userId) return null;
  const buyer = db.findById('users', order.userId);
  if (!buyer?.referredBy) return null;
  const referrer = db.findById('users', buyer.referredBy);
  if (!referrer) return null;
  if (referrer.id === buyer.id) return null;

  // শুধু-প্রথম-অর্ডার সেটিং: ক্রেতার আগের ডেলিভার্ড অর্ডার থাকলে বাদ
  if (enabled('referral_first_only')) {
    const priorDelivered = db
      .collection('orders')
      .filter((o) => o.userId === buyer.id && o.status === 'DELIVERED' && o.orderNumber !== order.orderNumber);
    if (priorDelivered.length > 0) return null;
  }

  const pct = Number(s('referral_percent', '5')) || 0;
  if (pct <= 0) return null;
  const commission = Math.round((order.total * pct) / 100);
  if (commission <= 0) return null;

  const event: ReferralEvent = {
    id: uid('ref'),
    referrerUserId: referrer.id,
    referrerName: referrer.name,
    referredUserId: buyer.id,
    referredName: buyer.name,
    orderNumber: order.orderNumber,
    orderTotal: order.total,
    commission,
    status: 'APPROVED',
    note: null,
    createdAt: new Date().toISOString(),
  };
  db.append('referralEvents', event);
  return { commission, referrerId: referrer.id };
}

/** কমিশন তোলার আবেদন (অ্যাকাউন্ট পেজ থেকে) */
export function requestReferralWithdraw(
  user: User, amount: number, method: string, account: string
): { ok: boolean; error?: string } {
  if (amount <= 0) return { ok: false, error: 'সঠিক পরিমাণ লিখুন' };
  const min = Number(s('referral_min_withdraw', '500')) || 0;
  const balance = referralBalanceOf(user.id);
  if (amount < min) return { ok: false, error: `সর্বনিম্ন তোলা যাবে ৳${min}` };
  if (amount > balance) return { ok: false, error: `ব্যালেন্স অপর্যাপ্ত (বর্তমানে ৳${balance})` };
  const w: ReferralWithdraw = {
    id: uid('rw'),
    userId: user.id,
    userName: user.name,
    amount,
    method: method.trim(),
    account: account.trim(),
    status: 'PENDING',
    note: null,
    createdAt: new Date().toISOString(),
    processedAt: null,
  };
  db.append('referralWithdraws', w);
  return { ok: true };
}

/** অ্যাডমিন — উইথড্র আবেদন প্রসেস */
export function processReferralWithdraw(id: string, status: 'PAID' | 'REJECTED', note?: string): void {
  const w = db.findById('referralWithdraws', id);
  if (!w) return;
  db.put('referralWithdraws', { ...w, status, note: note ?? w.note, processedAt: new Date().toISOString() });
  if (status === 'REJECTED') {
    // রিজেক্ট হলে টাকা ফেরত — লজ হিসেবে রেখে দিই (event বাদ দেওয়া হয় না, শুধু withdraw REJECTED)
  }
}

// ═══════════════════════════ অ্যাব্যান্ডন্ড কার্ট ═══════════════════════════

let acTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * কার্ট পরিবর্তনের পরে কল হয় (addToCart/updateQty/remove/clear)।
 * ডিবাউন্স করে abandonedCarts কালেকশনে স্ন্যাপশট সেভ করে।
 */
export function syncAbandonedCart(): void {
  if (!enabled('ac_enabled')) return;
  if (acTimer) clearTimeout(acTimer);
  acTimer = setTimeout(() => {
    try {
      const user = getCurrentUser();
      const key = cartKeyFor(user?.id ?? null);
      const cart = getCart();
      const id = `ac_${key}`;
      const existing = db.findById('abandonedCarts', id);
      if (cart.items.length === 0) {
        // খালি কার্ট — আগের স্ন্যাপশট recovered মার্ক করো (অর্ডার হয়েছে/মুছেছে)
        if (existing && existing.status === 'open') {
          db.put('abandonedCarts', { ...existing, status: 'recovered', updatedAt: new Date().toISOString() });
        }
        return;
      }
      const now = new Date().toISOString();
      const snapshot: AbandonedCart = {
        id,
        userId: user?.id ?? null,
        name: user?.name || 'অতিথি ক্রেতা',
        phone: user?.phone || null,
        items: cart.items.map((i) => ({
          name: i.product.nameBn || i.product.name,
          qty: i.quantity,
          price: i.unitPrice,
          image: i.image ?? null,
        })),
        subtotal: cart.subtotal,
        status: 'open',
        updatedAt: now,
        lastRemindedAt: existing?.lastRemindedAt ?? null,
        remindedCount: existing?.remindedCount ?? 0,
      };
      db.put('abandonedCarts', snapshot);
    } catch {
      // অ্যাব্যান্ডন্ড-ট্র্যাকিং ব্যর্থ হলেও কেনাকাটা চলবে
    }
  }, 1500);
}

/** অর্ডার সফল হলে কার্ট স্ন্যাপশট recovered */
export function markCartRecovered(): void {
  try {
    const user = getCurrentUser();
    const id = `ac_${cartKeyFor(user?.id ?? null)}`;
    const existing = db.findById('abandonedCarts', id);
    if (existing) {
      db.put('abandonedCarts', { ...existing, status: 'recovered', updatedAt: new Date().toISOString() });
    }
  } catch {
    // ignore
  }
}

/** অ্যাডমিন — রিমাইন্ডার পাঠানো হলো মার্ক */
export function markCartReminded(id: string): void {
  const c = db.findById('abandonedCarts', id);
  if (!c) return;
  db.put('abandonedCarts', {
    ...c,
    status: 'reminded',
    lastRemindedAt: new Date().toISOString(),
    remindedCount: (c.remindedCount || 0) + 1,
  });
}

/** অ্যাব্যান্ডন্ড কার্ট SMS টেক্সট তৈরি */
export function abandonedCartSmsText(cart: AbandonedCart): string {
  const tpl = s(
    'sms_tpl_abandoned',
    'আপনার কার্টে {count} টি পণ্য অপেক্ষা করছে! এখনই অর্ডার সম্পূর্ণ করুন {site} {offer}'
  );
  return fillTemplate(tpl, {
    count: String(cart.items.reduce((n, i) => n + i.qty, 0)),
    subtotal: String(cart.subtotal),
    offer: s('ac_offer_text', ''),
  });
}

// ═══════════════════════════ SMS ═══════════════════════════

/** টেমপ্লেট ভেরিয়েবল পূরণ — {site} {order} {total} {status} {name} {count} {offer} */
export function fillTemplate(tpl: string, extra: Record<string, string> = {}): string {
  const vars: Record<string, string> = {
    site: siteName(),
    ...extra,
  };
  return tpl
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
    .replace(/\s+/g, ' ')
    .trim();
}

export function orderSmsText(order: Order, kind: 'order' | 'status', status?: OrderStatus): string {
  const tpl =
    kind === 'order'
      ? s('sms_tpl_order', '')
      : s('sms_tpl_status', '');
  if (!tpl) return '';
  return fillTemplate(tpl, {
    order: order.orderNumber,
    total: String(order.total),
    name: order.customerName,
    status: status ? STATUS_BN[status] ?? status : '',
  });
}

/**
 * SMS পাঠাও — সার্ভার API রুট দিয়ে (প্রোভাইডার কনফিগ RTDB থেকে সার্ভারই পড়ে)।
 * ফলাফল ক্লায়েন্টই smsLogs-এ লেখে (cloud sync করে)।
 */
export async function sendSms(input: {
  to: string;
  message: string;
  template?: string;
  orderNumber?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const provider = s('sms_provider_type', 'bulksmsbd');
  const log: SmsLog = {
    id: uid('sms'),
    to: input.to,
    message: input.message,
    template: input.template ?? null,
    orderNumber: input.orderNumber ?? null,
    status: 'sent',
    provider,
    error: null,
    createdAt: new Date().toISOString(),
  };
  if (!enabled('sms_enabled')) {
    db.append('smsLogs', { ...log, status: 'skipped', error: 'SMS বন্ধ আছে (সেটিংস)' });
    return { ok: false, error: 'SMS বন্ধ আছে' };
  }
  try {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: input.to, message: input.message }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string; skipped?: boolean };
    if (!data.ok) {
      db.append('smsLogs', { ...log, status: 'failed', error: data.error || 'প্রোভাইডার এরর' });
      return { ok: false, error: data.error || 'SMS পাঠানো যায়নি' };
    }
    db.append('smsLogs', log);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'নেটওয়ার্ক এরর';
    db.append('smsLogs', { ...log, status: 'failed', error: msg });
    return { ok: false, error: msg };
  }
}

/** অর্ডার ইভেন্টে অটো-SMS (updateOrderStatus/placeOrder থেকে fire-and-forget) */
export function sendOrderSms(order: Order, kind: 'order' | 'status', status?: OrderStatus): void {
  if (!enabled('sms_enabled')) return;
  if (!order.phone) return;
  const text = orderSmsText(order, kind, status);
  if (!text) return;
  void sendSms({ to: order.phone, message: text, template: kind, orderNumber: order.orderNumber });
  // অ্যাডমিন নোটিফিকেশন (নতুন অর্ডারে)
  if (kind === 'order') {
    const adminPhone = s('sms_admin_phone', '');
    if (adminPhone) {
      void sendSms({
        to: adminPhone,
        message: fillTemplate('নতুন অর্ডার {order} — {total} টাকা ({name}) - {site}', {
          order: order.orderNumber, total: String(order.total), name: order.customerName,
        }),
        template: 'admin_notify',
        orderNumber: order.orderNumber,
      });
    }
  }
}

// ═══════════════════════════ কুরিয়ার (Steadfast) ═══════════════════════════

export type SteadfastResult = {
  ok: boolean;
  error?: string;
  consignmentId?: string;
  trackingCode?: string;
  status?: string;
};

/**
 * অর্ডার Steadfast-এ পাঠাও — সার্ভার রুট /api/courier/steadfast দিয়ে
 * (API কী সার্ভারেই থাকে, ব্রাউজারে যায় না)।
 */
export async function sendToSteadfast(order: Order): Promise<SteadfastResult> {
  try {
    const res = await fetch('/api/courier/steadfast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice: order.orderNumber,
        recipient_name: order.customerName,
        recipient_phone: order.phone,
        recipient_address: `${order.address}, ${order.city}, ${order.district}`,
        cod_amount: order.paymentStatus === 'PAID' ? 0 : order.total,
        note: order.note || '',
      }),
    });
    const data = (await res.json()) as {
      ok: boolean; error?: string;
      consignment_id?: string; tracking_code?: string; status?: string;
    };
    if (!data.ok) return { ok: false, error: data.error || 'Steadfast API ব্যর্থ' };
    // অর্ডারে ট্র্যাকিং সেভ
    const now = new Date().toISOString();
    db.put('orders', {
      ...order,
      courierName: 'Steadfast',
      trackingNumber: data.tracking_code || data.consignment_id || null,
      status: order.status === 'PACKED' || order.status === 'PROCESSING' ? 'SHIPPED' : order.status,
      statusHistory: [
        ...order.statusHistory,
        { status: 'SHIPPED', at: now, note: `Steadfast কনসাইনমেন্ট: ${data.consignment_id ?? ''}`, by: 'steadfast-api' },
      ],
      updatedAt: now,
    });
    db.append('auditLogs', {
      id: uid('aud'),
      actor: getCurrentUser()?.name || 'admin',
      actorId: getCurrentUser()?.id ?? null,
      action: 'courier.steadfast',
      entity: 'order',
      entityId: order.orderNumber,
      details: `কনসাইনমেন্ট: ${data.consignment_id ?? '-'} / ট্র্যাকিং: ${data.tracking_code ?? '-'}`,
      createdAt: now,
    });
    return {
      ok: true,
      consignmentId: data.consignment_id,
      trackingCode: data.tracking_code,
      status: data.status,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'নেটওয়ার্ক এরর' };
  }
}

/** Steadfast ব্যালেন্স দেখো */
export async function steadfastBalance(): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    const res = await fetch('/api/courier/steadfast?action=balance', { method: 'GET' });
    const data = (await res.json()) as { ok: boolean; balance?: number; error?: string };
    return data;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'নেটওয়ার্ক এরর' };
  }
}

// ═══════════════════════════ পুশ টোকেন ═══════════════════════════

export function savePushToken(token: string, platform = 'browser'): void {
  const tokens = db.collection('pushTokens');
  if (tokens.some((t) => t.token === token)) return;
  const user = getCurrentUser();
  db.append('pushTokens', {
    id: uid('pt'),
    token,
    userId: user?.id ?? null,
    platform,
    createdAt: new Date().toISOString(),
  });
}

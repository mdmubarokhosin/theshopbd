/**
 * THE SHOP BD — লোকাল ডেটাবেস কোর ইঞ্জিন
 * ---------------------------------------------------------------------------
 * localStorage-ভিত্তিক ভার্সনড ডেটাবেস। প্রতিটি মিউটেশনে নতুন রেফারেন্স তৈরি হয়
 * (React re-render নিরাপদ), ক্রস-ট্যাব সিঙ্ক storage event দিয়ে হয়।
 *
 * ভবিষ্যৎ: রিয়েল ব্যাকএন্ড যোগ করতে চাইলে শুধু services.ts-এর ফাংশনগুলো
 * fetch() কলে বদলালেই হবে — UI কোড অপরিবর্তিত থাকবে।
 */
import type { DBData, DBCollection } from './types';
import { DB_VERSION, buildSeedData } from './seed-data';

const STORAGE_KEY = 'the_shop_bd_db_v1';

/** RTDB খালি অ্যারে রাখে না — খালি অ্যারে এই সেন্টিনেল অবজেক্ট হিসেবে সংরক্ষণ হয় */
const EMPTY_ARR = '__empty';

type AnyRec = Record<string, unknown>;
type Listener = () => void;

/** ক্যাশড খালি তালিকা — useSyncExternalStore snapshot স্থায়িত্বের জন্য */
const EMPTY_COLLECTION: unknown[] = [];

/**
 * লোকাল ডেটা → RTDB payload: প্রতিটি খালি অ্যারে `{"__empty":true}` হয়ে যায়
 * যেন RTDB রাউন্ড-ট্রিপে (push → snapshot) "কালেকশন ইচ্ছাকৃত খালি" অবস্থা হারিয়ে
 * না যায় এবং seed ডেটা ভুলভাবে ফিরে না আসে।
 */
export function encodeForRtdb<T>(value: T): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return { [EMPTY_ARR]: true };
    return value.map((v) => encodeForRtdb(v));
  }
  if (value && typeof value === 'object') {
    const out: AnyRec = {};
    for (const [k, v] of Object.entries(value as AnyRec)) out[k] = encodeForRtdb(v);
    return out;
  }
  return value;
}

/**
 * RTDB payload → লোকাল ডেটা: সেন্টিনেল → খালি অ্যারে, সংখ্যামূলক-কী অবজেক্ট → অ্যারে
 * (RTDB মাঝে মাঝে অ্যারেকে অবজেক্টে রূপ দেয়), বাকি সব ডিপ-কপি।
 * নোট: সব এন্টিটি আইডি prefix-যুক্ত (p_/ord_/cpn_...), তাই numeric-key মানেই অ্যারে।
 */
export function decodeFromRtdb<T>(value: T): unknown {
  if (Array.isArray(value)) return value.map((v) => decodeFromRtdb(v));
  if (value && typeof value === 'object') {
    const rec = value as AnyRec;
    const keys = Object.keys(rec);
    // খালি-অ্যারে সেন্টিনেল
    if (keys.length === 1 && keys[0] === EMPTY_ARR && rec[EMPTY_ARR] === true) return [];
    // numeric-key অবজেক্ট → অ্যারে (ইনডেক্স ক্রমে)
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => decodeFromRtdb(rec[k]));
    }
    const out: AnyRec = {};
    for (const [k, v] of Object.entries(rec)) out[k] = decodeFromRtdb(v);
    return out;
  }
  return value;
}

/**
 * এন্টিটি নরমালাইজার — RTDB রাউন্ড-ট্রিপ / পুরোনো ব্যাকআপে হারানো নেস্টেড অ্যারে ও
 * টাইপ মেরামত করে (applyRemote ও importJson দুই জায়গা থেকেই ব্যবহৃত)।
 * নিশ্চিত করে: product.images (JSON স্ট্রিং), product.variants[], order.items[],
 * order.statusHistory[], role.permissions[], flashSale.productIds[]/endsAt।
 */
function normalizeData(d: DBData): DBData {
  const out: AnyRec = { ...(d as unknown as AnyRec) };

  // flashSale — টাইপ গ্যারান্টি
  const rf = (out.flashSale ?? {}) as AnyRec;
  out.flashSale = {
    enabled: !!rf.enabled,
    title: typeof rf.title === 'string' && rf.title ? rf.title : 'ফ্ল্যাশ সেল',
    endsAt: typeof rf.endsAt === 'string' ? rf.endsAt : null,
    productIds: Array.isArray(rf.productIds) ? rf.productIds.map(String) : [],
  };

  // পণ্য — images সবসময় JSON স্ট্রিং, variants সবসময় অ্যারে
  if (Array.isArray(out.products)) {
    out.products = out.products.map((p: AnyRec) => ({
      ...p,
      images:
        typeof p.images === 'string'
          ? p.images
          : JSON.stringify(Array.isArray(p.images) ? p.images : []),
      variants: Array.isArray(p.variants) ? p.variants : [],
    }));
  }

  // অর্ডার — items/statusHistory সবসময় অ্যারে
  if (Array.isArray(out.orders)) {
    out.orders = out.orders.map((o: AnyRec) => ({
      ...o,
      items: Array.isArray(o.items) ? o.items : [],
      statusHistory: Array.isArray(o.statusHistory) ? o.statusHistory : [],
    }));
  }

  // রোল — permissions সবসময় অ্যারে (customer রোলের খালি অ্যারে RTDB-তে হারায়)
  if (Array.isArray(out.roles)) {
    const seedRoles = new Map((buildSeedData().roles ?? []).map((r) => [r.id, r]));
    out.roles = out.roles.map((r: AnyRec) => ({
      ...r,
      permissions: Array.isArray(r.permissions) ? r.permissions : (seedRoles.get(r.id as string)?.permissions ?? []),
    }));
  }

  // নোটিফিকেশন — RTDB অ্যারেতে ডিলিটে null হোল থেকে যায়, পুরোনো এন্ট্রিতে
  // createdAt/type মিসিং হতে পারে → key warning ও Invalid Date বন্ধ করা হয়
  if (Array.isArray(out.notifications)) {
    out.notifications = out.notifications
      .filter((n: AnyRec) => !!n && typeof n === 'object' && typeof n.id === 'string')
      .map((n: AnyRec) => ({
        ...n,
        userId: n.userId === undefined ? null : n.userId,
        title: typeof n.title === 'string' ? n.title : '',
        message: typeof n.message === 'string' ? n.message : '',
        type: typeof n.type === 'string' ? n.type : 'system',
        read: !!n.read,
        link: n.link ?? null,
        createdAt: typeof n.createdAt === 'string' ? n.createdAt : '',
      }));
  }

  // টিকেট — messages সবসময় অ্যারে
  if (Array.isArray(out.tickets)) {
    out.tickets = out.tickets.map((t: AnyRec) => ({
      ...t,
      messages: Array.isArray(t.messages) ? t.messages : [],
    }));
  }

  // ডেলিভারি জোন — districts সবসময় অ্যারে
  if (Array.isArray(out.deliveryZones)) {
    out.deliveryZones = out.deliveryZones.map((z: AnyRec) => ({
      ...z,
      districts: Array.isArray(z.districts) ? z.districts : [],
    }));
  }

  // স্লাইড — photos সবসময় অ্যারে
  if (Array.isArray(out.slides)) {
    out.slides = out.slides.map((s: AnyRec) => ({
      ...s,
      photos: Array.isArray(s.photos) ? s.photos : [],
    }));
  }

  return out as unknown as DBData;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

class LocalDatabase {
  private data: DBData | null = null;
  private listeners = new Set<Listener>();
  private storage: Storage | null = null;
  /** হাইড্রেশন পাস শেষ হয়েছে কি না — শেষ না হওয়া পর্যন্ত get() সিড ডেটা দেয় */
  private hydrated = false;
  /**
   * প্রি-হাইড্রেশন সিড ক্যাশ — get() প্রতিবার নতুন buildSeedData() দিলে
   * useCollection-এর getSnapshot অস্থিতিশীল হয় (React "getSnapshot should
   * be cached" এরর + অসীম রি-রেন্ডার ঝুঁকি)। তাই একবার বানিয়ে ক্যাশ করা হয়।
   */
  private seedSnapshot: DBData | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.storage = window.localStorage;
      this.load();
      // ক্রস-ট্যাব সিঙ্ক
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.reloadFromStorage();
        }
      });
    }
  }

  /** localStorage থেকে লোড; না থাকলে/ভার্সন মিল না হলে সিড করা */
  private load(): void {
    if (!this.storage) return;
    const parsed = safeParse<DBData>(this.storage.getItem(STORAGE_KEY));
    if (parsed && parsed.version === DB_VERSION) {
      // আংশিক/অসম্পূর্ণ ডেটা হলে অনুপস্থিত কালেকশন seed থেকে পূরণ হয়
      this.data = this.withDefaults(parsed);
    } else {
      const seed = buildSeedData();
      if (parsed) {
        // ভার্সন আপগ্রেড:
        // • কনটেন্ট কালেকশন (অ্যাডমিন-সিড) → নতুন সিড প্রাধান্য পায়
        // • ইউজার-ডেটা কালেকশন (অর্ডার/অ্যাকাউন্ট...) → পুরোনো ডেটা সংরক্ষিত
        const contentKeys: (keyof DBData)[] = [
          'slides', 'sideBanners', 'whyUs', 'testimonials', 'pages', 'settings',
          'announcements', 'flashSale', 'paymentMethods', 'deliveryZones', 'couriers', 'coupons',
          'products', 'categories', 'brands', 'productPerks',
        ];
        const merged: DBData = { ...seed };
        for (const [key, value] of Object.entries(parsed)) {
          if (value == null) continue;
          merged[key as keyof DBData] = contentKeys.includes(key as keyof DBData)
            ? (seed[key as keyof DBData] as never)
            : (value as never);
        }
        this.data = this.withDefaults(merged);
      } else {
        this.data = seed;
      }
      this.persist();
    }
  }

  /**
   * অনুপস্থিত/null কালেকশন seed থেকে পূরণ + পুরোনো ভার্সনের অবশিষ্ট কী পরিষ্কার।
   * v4-এর একক ঘোষণা বার চালু থাকলে সেটি নতুন announcements তালিকায় স্থানান্তর হয়।
   * null কালেকশনও seed দিয়ে পূরণ হয় (RTDB/ব্যাকআপে null থাকলে .length ক্র্যাশ বন্ধ)।
   */
  private withDefaults(d: Partial<DBData>): DBData {
    const seed = buildSeedData();
    const out = { ...seed } as DBData;
    for (const [key, value] of Object.entries(d)) {
      if (value === undefined || value === null) continue; // null/undefined → seed ডিফল্ট
      (out as unknown as Record<string, unknown>)[key] = value;
    }
    type LegacyBar = { enabled?: boolean; text?: string; link?: string | null };
    const legacy = (out as unknown as { announcement?: LegacyBar }).announcement;
    if (legacy?.enabled && legacy.text?.trim() && Array.isArray(out.announcements)) {
      out.announcements = [
        ...out.announcements,
        {
          id: 'ann_legacy', icon: 'bi-megaphone', text: legacy.text.trim(),
          link: legacy.link ?? null, enabled: true, sortOrder: out.announcements.length + 1,
        },
      ];
    }
    delete (out as unknown as Record<string, unknown>).announcement;
    return { ...normalizeData(out), version: DB_VERSION };
  }

  private reloadFromStorage(): void {
    if (!this.storage) return;
    const parsed = safeParse<DBData>(this.storage.getItem(STORAGE_KEY));
    if (parsed) {
      this.data = this.withDefaults(parsed);
      this.notify();
    }
  }

  private persist(): boolean {
    if (!this.storage || !this.data) return false;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      return true;
    } catch (err) {
      // কোটা অতিক্রম — মিডিয়া লাইব্রেরি থেকে পুরোনো ছবি সরিয়ে আবার চেষ্টা
      console.warn('localStorage quota exceeded', err);
      try {
        const d = { ...this.data, media: this.data.media.slice(-12) };
        this.storage.setItem(STORAGE_KEY, JSON.stringify(d));
        this.data = d;
        return true;
      } catch {
        return false;
      }
    }
  }

  // ── রিড ──
  get(): DBData {
    // SSR ও ক্লায়েন্ট হাইড্রেশন পাসে সিড ডেটা — সার্ভার HTML-এর সাথে হুবহু মিলে
    // যায় (React 19 hydration mismatch বন্ধ)। CloudProvider-এর effect হাইড্রেশন
    // শেষ হলে markHydrated() কল করে — এরপরই localStorage/RTDB মিরর দেখানো হয়।
    if (!this.hydrated) {
      if (!this.seedSnapshot) this.seedSnapshot = buildSeedData();
      return this.seedSnapshot;
    }
    if (!this.data) {
      this.data = buildSeedData();
    }
    return this.data;
  }

  /**
   * হাইড্রেশন শেষ — CloudProvider-এর useEffect থেকে একবারই কল হয়।
   * এরপর get() লোকাল মিরর (localStorage/RTDB সিঙ্ক করা ডেটা) রিটার্ন করে।
   */
  markHydrated(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    this.notify();
  }

  collection<K extends DBCollection>(name: K): DBData[K] {
    // পুরোনো ভার্সনের ডেটা/ব্যাকআপে নতুন কালেকশন না থাকলেও ক্র্যাশ না করে খালি তালিকা।
    // ক্যাশড কনস্ট্যান্ট — প্রতিবার নতুন [] রিটার্ন করলে useSyncExternalStore অসীম রি-রেন্ডার করে।
    const value = this.get()[name];
    return (value ?? EMPTY_COLLECTION) as DBData[K];
  }

  // ── রাইট ──
  private write(mutator: (data: DBData) => DBData): void {
    if (!this.data) this.data = buildSeedData();
    const next = mutator(this.data);
    this.data = { ...next, version: DB_VERSION };
    this.persist();
    this.notify();
  }

  setCollection<K extends DBCollection>(name: K, items: DBData[K]): void {
    this.write((d) => ({ ...d, [name]: items }));
  }

  /** কালেকশনে আইটেম যোগ (শুরুতে) */
  prepend<K extends DBCollection>(name: K, item: DBData[K][number]): void {
    this.setCollection(name, [item, ...(this.collection(name) as DBData[K])] as DBData[K]);
  }

  append<K extends DBCollection>(name: K, item: DBData[K][number]): void {
    this.setCollection(name, [...(this.collection(name) as DBData[K]), item] as DBData[K]);
  }

  put<K extends DBCollection>(name: K, item: DBData[K][number]): void {
    const items = this.collection(name) as { id: string }[];
    const idx = items.findIndex((x) => x.id === (item as { id: string }).id);
    const next = idx >= 0 ? items.map((x) => (x.id === (item as { id: string }).id ? item : x)) : [item, ...items];
    this.setCollection(name, next as DBData[K]);
  }

  remove<K extends DBCollection>(name: K, id: string): void {
    const items = this.collection(name) as { id: string }[];
    this.setCollection(name, items.filter((x) => x.id !== id) as DBData[K]);
  }

  findById<K extends DBCollection>(name: K, id: string): DBData[K][number] | undefined {
    return (this.collection(name) as { id: string }[]).find((x) => x.id === id) as DBData[K][number] | undefined;
  }

  updateSettings(patch: Partial<DBData['settings']>): void {
    this.write((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }

  updateFlashSale(patch: Partial<DBData['flashSale']>): void {
    this.write((d) => ({ ...d, flashSale: { ...d.flashSale, ...patch } }));
  }

  /** একাধিক কালেকশন একসাথে রাইট (atomic order flow-এর জন্য) */
  writeBulk(patch: Partial<DBData>): void {
    this.write((d) => ({ ...d, ...patch }));
  }

  // ── সাবস্ক্রিপশন ──
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify(): void {
    for (const l of Array.from(this.listeners)) {
      try {
        l();
      } catch {
        // ignore listener errors
      }
    }
  }

  /**
   * Firebase Realtime Database থেকে আসা ডেটা লোকাল মিররে প্রয়োগ করা
   * (cloud.ts সিঙ্ক ইঞ্জিন ব্যবহার করে — RTDB = সোর্স অব ট্রুথ)।
   * • decodeFromRtdb: সেন্টিনেল → খালি অ্যারে, numeric-key অবজেক্ট → অ্যারে
   * • settings ডিপ-মার্জ হয় যেন নতুন ফিল্ড (যেমন github_*) ডিফল্ট থেকে পূরণ হয়
   * • normalizeData: নেস্টেড অ্যারে/টাইপ গ্যারান্টি (বিস্তারিত ফাংশন ডক-এ)
   */
  applyRemote(remote: Partial<DBData>): void {
    const seed = buildSeedData();
    const dec = decodeFromRtdb(remote) as Partial<DBData>;
    const merged = { ...seed, ...dec } as DBData;
    merged.settings = { ...seed.settings, ...(dec.settings ?? {}) };
    this.data = this.withDefaults(merged);
    this.persist();
    this.notify();
  }

  // ── ব্যাকআপ / রিসেট ──
  exportJson(): string {
    return JSON.stringify(this.get(), null, 2);
  }

  importJson(json: string): { ok: boolean; error?: string } {
    const parsed = safeParse<Partial<DBData>>(json);
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'ফাইল পড়া যায়নি' };
    if (!parsed.version) return { ok: false, error: 'অবৈধ ব্যাকআপ ফাইল (version নেই)' };
    this.data = this.withDefaults(parsed);
    this.persist();
    this.notify();
    return { ok: true };
  }

  resetAll(): void {
    this.data = buildSeedData();
    this.persist();
    this.notify();
  }
}

export const db = new LocalDatabase();

/** নতুন আইডি তৈরি */
export function uid(prefix = ''): string {
  const core =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return prefix ? `${prefix}_${core}` : core;
}

/** অর্ডার নাম্বার: TS-YYMMDD-XXXX */
export function orderNumber(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TS-${ymd}-${rand}`;
}

export { DB_VERSION };

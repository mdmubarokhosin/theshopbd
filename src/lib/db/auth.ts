/**
 * THE SHOP BD — অথেন্টিকেশন ও সেশন ম্যানেজার (Firebase Auth ভিত্তিক)
 * ---------------------------------------------------------------------------
 * • Google Sign-in — প্রোফাইল (নাম/ইমেইল/ছবি) Google অ্যাকাউন্ট থেকে অটো-ফিল হয়
 * • Email/Password — ইউজার রেজিস্ট্রেশন/লগইন + রিয়েল পাসওয়ার্ড রিসেট ইমেইল
 * • অ্যাডমিন বুটস্ট্র্যাপ — Firebase/DB-তে কোনো অ্যাডমিন না থাকলে প্রথম রেজিস্ট্রেশন
 *   করা ব্যক্তি অটোমেটিক সুপার অ্যাডমিন হয়; থাকলে লগইন ফর্ম দেখানো হয়
 * • ইউজার প্রোফাইল রেকর্ড RTDB `users` কালেকশনে (id = Firebase uid)
 * • লগইনে গেস্ট কার্ট ইউজার কার্টের সাথে মার্জ হয়
 * • কোনো ক্রেডেনশিয়াল কোডে হার্ডকোড করা নেই
 */
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile as fbUpdateProfile,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { db } from './core';
import { firebaseAuth, googleProvider, secondaryAuth, firebaseErrorMessage } from '@/lib/firebase/app';
import type { User, Role, Address, Permission } from './types';

const AUTH_UID_KEY = 'tsb_auth_uid';
const GUEST_CART_KEY = 'tsb_cart';
const USER_CART_PREFIX = 'tsb_cart_user_';
const RECENT_KEY = 'tsb_recent_viewed';
const COMPARE_KEY = 'tsb_compare';

// ───────────────────────────── সেশন ব্রিজ ─────────────────────────────

/** বর্তমান লগইন করা ইউজার (Firebase Auth সেশন + RTDB প্রোফাইল) */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  let fbUid: string | null = null;
  try {
    fbUid = localStorage.getItem(AUTH_UID_KEY);
  } catch {
    return null;
  }
  if (!fbUid) return null;
  const user = db.findById('users', fbUid) as User | undefined;
  if (!user || user.status !== 'active') return null;
  return user;
}

/** সামঞ্জস্যের জন্য — আইডি বা null */
export function currentUserId(): string | null {
  return getCurrentUser()?.id ?? null;
}

/** লগআউট — Firebase সেশন + লোকাল কী দুটোই পরিষ্কার */
export function logout(): void {
  try {
    localStorage.removeItem(AUTH_UID_KEY);
  } catch {
    // ignore
  }
  const auth = firebaseAuth();
  if (auth) void fbSignOut(auth).catch(() => undefined);
}

// ───────────────────────────── Firebase Auth ইনিট ─────────────────────────────

let authListenerStarted = false;

/** CloudProvider থেকে কল হয় — Auth স্টেট ↔ লোকাল সেশন ব্রিজ (রি-সাবস্ক্রাইবযোগ্য) */
export function initFirebaseAuth(): () => void {
  const auth = firebaseAuth();
  if (!auth) return () => undefined;
  if (authListenerStarted) return () => undefined;
  authListenerStarted = true;

  const unsub = onAuthStateChanged(auth, async (fbUser) => {
    try {
      if (fbUser) {
        try {
          localStorage.setItem(AUTH_UID_KEY, fbUser.uid);
        } catch {
          // ignore
        }
        // নতুন ডিভাইস/হারানো রেকর্ড — প্রোফাইল রেকর্ড নিশ্চিত করা
        const existing = db.findById('users', fbUser.uid) as User | undefined;
        if (!existing) await ensureUserRecord(fbUser);
      } else {
        try {
          localStorage.removeItem(AUTH_UID_KEY);
        } catch {
          // ignore
        }
      }
    } finally {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tsb:auth'));
        window.dispatchEvent(new Event('tsb:auth-ready'));
      }
    }
  });
  // React StrictMode এ ইফেক্ট দুইবার চলে — cleanup-এর পরে আবার সাবস্ক্রাইব করা যাবে
  return () => {
    authListenerStarted = false;
    unsub();
  };
}

// ───────────────────────────── রোল ও পারমিশন ─────────────────────────────

export function getRole(roleId: string): Role | undefined {
  return db.collection('roles').find((r) => r.id === roleId);
}

export function userPermissions(user: User | null): Permission[] {
  if (!user) return [];
  const role = getRole(user.roleId);
  // RTDB খালি অ্যারে ড্রপ করলে permissions undefined হতে পারে — সবসময় অ্যারে নিশ্চিত করুন
  return role && Array.isArray(role.permissions) ? role.permissions : [];
}

/** পারমিশন চেক (কাস্টমার রোলে কোনো অ্যাডমিন পারমিশন নেই) */
export function can(user: User | null, permission: Permission): boolean {
  return userPermissions(user).includes(permission);
}

export function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  return user.roleId !== 'customer';
}

/** Firebase/DB-তে অ্যাডমিন অ্যাকাউন্ট আছে কি না (অ্যাডমিন গেট বুটস্ট্র্যাপ) */
export function adminExists(): boolean {
  return db.collection('users').some((u) => u.roleId !== 'customer' && u.status === 'active');
}

// ───────────────────────────── ইউজার রেকর্ড ─────────────────────────────

/**
 * Firebase Auth ইউজার → RTDB `users` রেকর্ড (না থাকলে তৈরি, থাকলে সিঙ্ক)।
 * Google হলে নাম/ইমেইল/ছবি অটো-ফিল হয়।
 */
async function ensureUserRecord(fbUser: FirebaseUser): Promise<User> {
  const existing = db.findById('users', fbUser.uid) as User | undefined;
  const provider = fbUser.providerData[0]?.providerId ?? 'password';
  const name =
    fbUser.displayName ||
    existing?.name ||
    (fbUser.email ? fbUser.email.split('@')[0] : 'ইউজার');
  const email = fbUser.email ?? existing?.email ?? null;
  const phone = fbUser.phoneNumber ?? existing?.phone ?? null;
  const avatar = fbUser.photoURL ?? existing?.avatar ?? null;
  const emailVerified = fbUser.emailVerified || !!existing?.emailVerified;
  const nowIso = new Date().toISOString();

  if (existing) {
    const staleLogin =
      !existing.lastLoginAt || Date.now() - new Date(existing.lastLoginAt).getTime() > 24 * 60 * 60 * 1000;
    if (
      existing.name !== name ||
      existing.email !== email ||
      existing.avatar !== avatar ||
      existing.phone !== phone ||
      existing.emailVerified !== emailVerified ||
      staleLogin
    ) {
      const next: User = { ...existing, name, email, phone, avatar, emailVerified, lastLoginAt: nowIso };
      db.put('users', next);
      mergeGuestCart(next.id);
      return next;
    }
    return existing;
  }

  const user: User = {
    id: fbUser.uid,
    name,
    email,
    phone,
    passwordHash: 'firebase-auth',
    salt: 'firebase',
    roleId: 'customer', // নিরাপত্তা: নতুন ইউজার সবসময় Customer — অ্যাডমিন পথ আলাদা
    avatar,
    status: 'active',
    emailVerified,
    phoneVerified: !!fbUser.phoneNumber,
    dateOfBirth: null,
    customerGroup: 'regular',
    groupNote: null,
    newsletterSubscribed: false,
    createdAt: nowIso,
    lastLoginAt: nowIso,
  };
  db.put('users', user);
  mergeGuestCart(user.id);
  return user;
}

// ───────────────────────────── Google Sign-in ─────────────────────────────

/** Google দিয়ে লগইন/রেজিস্ট্রেশন — প্রোফাইল অটো-ফিল */
export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string; user?: User }> {
  const auth = firebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase Auth চালু হয়নি' };
  try {
    const cred = await signInWithPopup(auth, googleProvider());
    const user = await ensureUserRecord(cred.user);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('tsb:auth'));
    return { ok: true, user };
  } catch (err) {
    return { ok: false, error: firebaseErrorMessage(err) };
  }
}

// ───────────────────────────── Email/Password ─────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ইমেইল+পাসওয়ার্ড রেজিস্ট্রেশন (পাবলিক ইউজার — সবসময় Customer) */
export async function registerWithEmail(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  newsletter?: boolean;
  refCode?: string;                 // রেফারেল কোড (যে পাঠিয়েছে তার userId সেভ হয়)
}): Promise<{ ok: boolean; error?: string; user?: User }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  if (!name) return { ok: false, error: 'নাম দিন' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'সঠিক ইমেইল দিন' };
  if (input.password.length < 6) return { ok: false, error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' };

  const auth = firebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase Auth চালু হয়নি' };
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, input.password);
    await fbUpdateProfile(cred.user, { displayName: name });
    const user = await ensureUserRecord(cred.user);
    // রেফারেল অ্যাট্রিবিউশন
    let referredBy: string | null = null;
    if (input.refCode?.trim()) {
      const referrer = db
        .collection('users')
        .find((u) => (u.refCode || '').toUpperCase() === input.refCode!.trim().toUpperCase());
      if (referrer && referrer.id !== user.id) referredBy = referrer.id;
    }
    const withExtras: User = {
      ...user,
      phone: phone ?? user.phone,
      newsletterSubscribed: !!input.newsletter,
      referredBy,
    };
    db.put('users', withExtras);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('tsb:auth'));
    return { ok: true, user: withExtras };
  } catch (err) {
    return { ok: false, error: firebaseErrorMessage(err) };
  }
}

/** ইমেইল+পাসওয়ার্ড লগইন */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; user?: User }> {
  const auth = firebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase Auth চালু হয়নি' };
  const mail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return { ok: false, error: 'সঠিক ইমেইল দিন' };
  try {
    const cred = await signInWithEmailAndPassword(auth, mail, password);
    const user = await ensureUserRecord(cred.user);
    if (user.status === 'suspended') {
      await fbSignOut(auth);
      return { ok: false, error: 'আপনার অ্যাকাউন্ট সাময়িকভাবে বন্ধ করা হয়েছে' };
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('tsb:auth'));
    return { ok: true, user };
  } catch (err) {
    return { ok: false, error: firebaseErrorMessage(err) };
  }
}

/** রিয়েল পাসওয়ার্ড রিসেট ইমেইল */
export async function sendResetEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const auth = firebaseAuth();
  if (!auth) return { ok: false, error: 'Firebase Auth চালু হয়নি' };
  const mail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return { ok: false, error: 'সঠিক ইমেইল দিন' };
  try {
    await sendPasswordResetEmail(auth, mail);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: firebaseErrorMessage(err) };
  }
}

// ───────────────────────────── অ্যাডমিন বুটস্ট্র্যাপ ─────────────────────────────

/**
 * প্রথম অ্যাডমিন রেজিস্ট্রেশন — DB-তে কোনো অ্যাডমিন না থাকলেই শুধু চলবে;
 * রেজিস্ট্রেশনকারী অটোমেটিক সুপার অ্যাডমিন হয়ে যায়।
 */
export async function registerFirstAdmin(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (adminExists()) return { ok: false, error: 'অ্যাডমিন অ্যাকাউন্ট ইতিমধ্যে আছে — লগইন করুন' };
  const res = await registerWithEmail({ name: input.name, email: input.email, password: input.password });
  if (!res.ok || !res.user) return { ok: false, error: res.error };
  const admin: User = { ...res.user, roleId: 'super_admin', emailVerified: true };
  db.put('users', admin);
  db.append('auditLogs', {
    id: `aud_${Date.now().toString(36)}`,
    actor: admin.email || 'admin',
    actorId: admin.id,
    action: 'admin.bootstrap',
    entity: 'user',
    entityId: admin.email,
    details: 'প্রথম অ্যাডমিন রেজিস্ট্রেশন (অটো সুপার অ্যাডমিন)',
    createdAt: new Date().toISOString(),
  });
  return { ok: true };
}

/** অ্যাডমিন লগইন — কাস্টমার অ্যাকাউন্ট হলে সেশন বাতিল */
export async function loginAdmin(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; user?: User }> {
  const res = await loginWithEmail(email, password);
  if (!res.ok || !res.user) return res;
  if (!isAdminUser(res.user)) {
    logout();
    return { ok: false, error: 'এটি কাস্টমার অ্যাকাউন্ট — অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন' };
  }
  return res;
}

// ───────────────────────────── স্টাফ (সেকেন্ডারি অ্যাপ) ─────────────────────────────

/**
 * স্টাফ অ্যাকাউন্ট তৈরি — সেকেন্ডারি Firebase অ্যাপে তৈরি হয় যেন বর্তমান
 * অ্যাডমিনের সেশন অক্ষত থাকে (Firebase ক্লায়েন্ট SDK-র জানা সীমাবদ্ধতা)।
 */
export async function createStaff(input: {
  name: string;
  email: string;
  password: string;
  roleId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = getCurrentUser();
  if (!can(actor, 'roles.manage')) return { ok: false, error: 'অনুমতি নেই' };
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'সঠিক ইমেইল দিন' };
  if (input.password.length < 6) return { ok: false, error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' };
  if (db.collection('users').some((u) => u.email?.toLowerCase() === email)) {
    return { ok: false, error: 'এই ইমেইল ব্যবহৃত' };
  }
  const role = db.findById('roles', input.roleId);
  if (!role) return { ok: false, error: 'রোল পাওয়া যায়নি' };

  const sAuth = secondaryAuth();
  if (!sAuth) return { ok: false, error: 'Firebase Auth চালু হয়নি' };
  try {
    const cred = await createUserWithEmailAndPassword(sAuth, email, input.password);
    await fbUpdateProfile(cred.user, { displayName: input.name.trim() });
    const nowIso = new Date().toISOString();
    db.put('users', {
      id: cred.user.uid,
      name: input.name.trim(),
      email,
      phone: null,
      passwordHash: 'firebase-auth',
      salt: 'firebase',
      roleId: input.roleId,
      avatar: null,
      status: 'active',
      emailVerified: false,
      phoneVerified: false,
      dateOfBirth: null,
      customerGroup: null,
      groupNote: null,
      newsletterSubscribed: false,
      createdAt: nowIso,
      lastLoginAt: null,
    });
    db.append('auditLogs', {
      id: `aud_${Date.now().toString(36)}`,
      actor: actor?.email || 'admin',
      actorId: actor?.id ?? null,
      action: 'staff.create',
      entity: 'user',
      entityId: email,
      details: `role: ${role.nameBn}`,
      createdAt: nowIso,
    });
    await fbSignOut(sAuth); // সেকেন্ডারি সেশন বন্ধ — মূল অ্যাডমিন লগইন অটুট
    return { ok: true };
  } catch (err) {
    try {
      await fbSignOut(sAuth);
    } catch {
      // ignore
    }
    return { ok: false, error: firebaseErrorMessage(err) };
  }
}

// ───────────────────────────── প্রোফাইল ─────────────────────────────

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<User, 'name' | 'email' | 'phone' | 'avatar' | 'dateOfBirth' | 'newsletterSubscribed'>>
): Promise<{ ok: boolean; error?: string }> {
  const user = db.findById('users', userId) as User | undefined;
  if (!user) return { ok: false, error: 'ইউজার পাওয়া যায়নি' };
  if (patch.email && patch.email !== user.email) {
    const exists = db
      .collection('users')
      .some((u) => u.id !== userId && u.email?.toLowerCase() === patch.email!.toLowerCase());
    if (exists) return { ok: false, error: 'এই ইমেইল অন্য অ্যাকাউন্টে ব্যবহৃত' };
  }
  if (patch.phone && patch.phone !== user.phone) {
    const exists = db.collection('users').some((u) => u.id !== userId && u.phone === patch.phone);
    if (exists) return { ok: false, error: 'এই নম্বর অন্য অ্যাকাউন্টে ব্যবহৃত' };
  }
  db.put('users', { ...user, ...patch });

  // Firebase Auth প্রোফাইলেও নাম/ছবি সিঙ্ক করা হয়
  const auth = firebaseAuth();
  const cu = auth?.currentUser;
  if (cu && cu.uid === userId) {
    const authPatch: { displayName?: string; photoURL?: string | null } = {};
    if (patch.name && patch.name !== cu.displayName) authPatch.displayName = patch.name;
    if (patch.avatar !== undefined && patch.avatar !== cu.photoURL) authPatch.photoURL = patch.avatar;
    if (Object.keys(authPatch).length) {
      try {
        await fbUpdateProfile(cu, authPatch);
      } catch {
        // অথ-প্রোফাইল আপডেট ব্যর্থ হলেও লোকাল প্রোফাইল সংরক্ষিত
      }
    }
  }
  return { ok: true };
}

/** পাসওয়ার্ড পরিবর্তন — Firebase Auth (রিঅথেন্টিকেশন সহ) */
export async function changePassword(
  _userId: string,
  current: string,
  next: string
): Promise<{ ok: boolean; error?: string }> {
  const auth = firebaseAuth();
  const cu = auth?.currentUser;
  if (!auth || !cu) return { ok: false, error: 'লগইন করা নেই' };
  const hasPasswordProvider = cu.providerData.some((p) => p.providerId === 'password');
  if (!hasPasswordProvider) {
    return { ok: false, error: 'এই অ্যাকাউন্ট Google দিয়ে খোলা — পাসওয়ার্ড Google সেটিংস থেকে পরিবর্তন করুন' };
  }
  if (next.length < 6) return { ok: false, error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' };
  if (!cu.email) return { ok: false, error: 'ইমেইল পাওয়া যায়নি' };
  try {
    const cred = EmailAuthProvider.credential(cu.email, current);
    await reauthenticateWithCredential(cu, cred);
    await fbUpdatePassword(cu, next);
    return { ok: true };
  } catch (err) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return { ok: false, error: 'বর্তমান পাসওয়ার্ড ভুল' };
    }
    return { ok: false, error: firebaseErrorMessage(err) };
  }
}

/** অ্যাকাউন্টে পাসওয়ার্ড লগইন আছে কি না (Google-only না কি) */
export function hasPasswordProvider(): boolean {
  const cu = firebaseAuth()?.currentUser;
  return !!cu && cu.providerData.some((p) => p.providerId === 'password');
}

// ───────────────────────────── কার্ট মার্জ ─────────────────────────────

type RawCartItem = { productId: string; variantKey: string; quantity: number };

function readRawCart(key: string): RawCartItem[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as RawCartItem[]) : [];
  } catch {
    return [];
  }
}

function writeRawCart(key: string, items: RawCartItem[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function cartKeyFor(userId: string | null): string {
  return userId ? USER_CART_PREFIX + userId : GUEST_CART_KEY;
}

function mergeGuestCart(userId: string): void {
  const guest = readRawCart(GUEST_CART_KEY);
  if (!guest.length) return;
  const userCart = readRawCart(cartKeyFor(userId));
  const merged = [...userCart];
  for (const g of guest) {
    const existing = merged.find((m) => m.productId === g.productId && m.variantKey === g.variantKey);
    if (existing) existing.quantity += g.quantity;
    else merged.push({ ...g });
  }
  writeRawCart(cartKeyFor(userId), merged);
  writeRawCart(GUEST_CART_KEY, []);
}

// ───────────────────────────── ঠিকানা ─────────────────────────────

export function userAddresses(userId: string): Address[] {
  return db.collection('addresses').filter((a) => a.userId === userId);
}

export function saveAddress(input: Omit<Address, 'id' | 'createdAt'>): Address {
  const addresses = db.collection('addresses');
  const isFirst = !addresses.some((a) => a.userId === input.userId);
  const addr: Address = {
    ...input,
    isDefaultShipping: input.isDefaultShipping || isFirst,
    isDefaultBilling: input.isDefaultBilling || isFirst,
    id: `addr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  const cleaned = addresses
    .filter((a) => a.userId === input.userId)
    .map((a) => ({
      ...a,
      isDefaultShipping: addr.isDefaultShipping ? false : a.isDefaultShipping,
      isDefaultBilling: addr.isDefaultBilling ? false : a.isDefaultBilling,
    }));
  const others = addresses.filter((a) => a.userId !== input.userId);
  db.setCollection('addresses', [...others, ...cleaned, addr]);
  return addr;
}

export function deleteAddress(addressId: string, userId: string): void {
  const remaining = db.collection('addresses').filter((a) => !(a.id === addressId && a.userId === userId));
  db.setCollection('addresses', remaining);
  const userAddrs = remaining.filter((a) => a.userId === userId);
  if (userAddrs.length && !userAddrs.some((a) => a.isDefaultShipping)) {
    db.put('addresses', { ...userAddrs[0], isDefaultShipping: true });
  }
}

// ───────────────────────────── সাম্প্রতিক দেখা / তুলনা ─────────────────────────────

let recentCache: string[] | null = null;

export function getRecentlyViewed(): string[] {
  if (typeof window === 'undefined') return [];
  if (recentCache) return recentCache;
  try {
    recentCache = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[];
  } catch {
    recentCache = [];
  }
  return recentCache;
}

export function pushRecentlyViewed(productId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getRecentlyViewed().filter((id) => id !== productId);
    list.unshift(productId);
    recentCache = list.slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentCache));
    window.dispatchEvent(new Event('tsb:recent'));
  } catch {
    // ignore
  }
}

export function getCompareList(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

export function toggleCompare(productId: string): string[] {
  if (typeof window === 'undefined') return [];
  const list = getCompareList();
  const next = list.includes(productId)
    ? list.filter((id) => id !== productId)
    : [...list, productId].slice(-4);
  localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('tsb:compare'));
  return next;
}

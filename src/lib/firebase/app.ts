/**
 * THE SHOP BD — Firebase কোর মডিউল
 * ---------------------------------------------------------------------------
 * • Firebase Realtime Database = সাইটের একমাত্র সোর্স অব ট্রুথ (Firestore ব্যবহার নিষিদ্ধ)
 * • Firebase Auth = Google Sign-in + Email/Password (ইউজার ও অ্যাডমিন)
 * • Analytics = ইউজারের দেওয়া কনফিগ অনুযায়ী (সাপোর্টেড এনভায়রনমেন্টেই চালু হয়)
 *
 * নোট: এই ওয়েব কনফিগটি পাবলিক তথ্য (Firebase নিরাপত্তা RTDB Rules + Auth
 * প্রোভাইডার দিয়ে নিয়ন্ত্রিত হয়)। পরিবর্তন করতে নিচের firebaseConfig এডিট করুন।
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

/** ইউজারের দেওয়া Firebase প্রজেক্ট কনফিগ */
export const firebaseConfig = {
  apiKey: 'AIzaSyDpUB5ZJzIuYYcZIwC_TI8DfU19t9G3li8',
  authDomain: 'theshopbd-fcc94.firebaseapp.com',
  databaseURL: 'https://theshopbd-fcc94-default-rtdb.firebaseio.com',
  projectId: 'theshopbd-fcc94',
  storageBucket: 'theshopbd-fcc94.firebasestorage.app',
  messagingSenderId: '466070461824',
  appId: '1:466070461824:web:106fcddc6bef4ffeab3565',
  measurementId: 'G-GT12BPGK6Q',
};

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Database | null = null;

function ensureApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null; // SSR-এ Firebase চালু হবে না
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

/** Firebase Auth (শুধু ব্রাউজারে) */
export function firebaseAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  if (!authInstance) {
    const a = ensureApp();
    if (!a) return null;
    authInstance = getAuth(a);
    // সেশন ব্রাউজারে স্থায়ী থাকবে (ট্যাব বন্ধ করলেও লগইন থাকে)
    void setPersistence(authInstance, browserLocalPersistence).catch(() => undefined);
  }
  return authInstance;
}

/** Firebase Realtime Database (শুধু ব্রাউজারে) — Firestore কখনোই ব্যবহার হয় না */
export function firebaseDb(): Database | null {
  if (typeof window === 'undefined') return null;
  if (!dbInstance) {
    const a = ensureApp();
    if (!a) return null;
    dbInstance = getDatabase(a);
  }
  return dbInstance;
}

/** Google Sign-in প্রোভাইডার */
export function googleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

/**
 * সেকেন্ডারি Auth ইনস্ট্যান্স — স্টাফ অ্যাকাউন্ট তৈরির সময় বর্তমান
 * অ্যাডমিনের সেশন যেন রিপ্লেস না হয় (Firebase ক্লায়েন্ট SDK সীমাবদ্ধতা)।
 */
export function secondaryAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  const a = ensureApp();
  if (!a) return null;
  const secondary = getApps().find((x) => x.name === 'secondary') ?? initializeApp(firebaseConfig, 'secondary');
  return getAuth(secondary);
}

let analyticsStarted = false;

/** Google Analytics — সাপোর্টেড এনভায়রনমেন্টে একবারই চালু হয় */
export async function initAnalytics(): Promise<void> {
  if (typeof window === 'undefined' || analyticsStarted) return;
  analyticsStarted = true;
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    const supported = await isSupported();
    if (!supported) return;
    const a = ensureApp();
    if (a) getAnalytics(a);
  } catch {
    // ব্লকার/অ্যাডব্লকার থাকলে নীরবে এড়িয়ে যাওয়া হয় — সাইটের কার্যক্ষমতায় প্রভাব নেই
  }
}

/** Firebase Auth এরর → বাংলা বার্তা */
export function firebaseErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'সঠিক ইমেইল ঠিকানা দিন';
    case 'auth/user-disabled':
      return 'এই অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে';
    case 'auth/user-not-found':
      return 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'ইমেইল বা পাসওয়ার্ড ভুল হয়েছে';
    case 'auth/email-already-in-use':
      return 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে — লগইন করুন';
    case 'auth/weak-password':
      return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে';
    case 'auth/too-many-requests':
      return 'অনেকবার চেষ্টা হয়েছে — কিছুক্ষণ পর আবার চেষ্টা করুন';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google লগইন বাতিল করা হয়েছে';
    case 'auth/popup-blocked':
      return 'ব্রাউজার পপআপ ব্লক করেছে — পপআপ অনুমতি দিন';
    case 'auth/account-exists-with-different-credential':
      return 'এই ইমেইলে অন্য পদ্ধতিতে অ্যাকাউন্ট আছে — সেই পদ্ধতিতে লগইন করুন';
    case 'auth/network-request-failed':
      return 'ইন্টারনেট সংযোগ পরীক্ষা করুন';
    case 'auth/operation-not-allowed':
      return 'Firebase Console-এ এই সাইন-ইন পদ্ধতি চালু করা হয়নি';
    default:
      break;
  }
  const msg = err instanceof Error ? err.message : '';
  if (msg.includes('Permission denied')) {
    return 'Realtime Database পারমিশন নেই — Firebase Console-এ Rules ঠিক করুন';
  }
  return code ? `লগইন ব্যর্থ হয়েছে (${code})` : 'অপ্রত্যাশিত সমস্যা হয়েছে — আবার চেষ্টা করুন';
}

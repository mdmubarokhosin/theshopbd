'use client';

/**
 * THE SHOP BD — Firebase Realtime Database সিঙ্ক ইঞ্জিন
 * ---------------------------------------------------------------------------
 * আর্কিটেকচার (Firestore সম্পূর্ণ বাদ — শুধুই RTDB):
 *
 *   RTDB (`shop` নোড)  ←—— সোর্স অব ট্রুথ (সব ডিভাইসে একই ডেটা)
 *        ↑  ডিবাউন্সড push (লোকাল মিউটেশনের পর)
 *        ↓  onValue লিসেনার (রিয়েল-টাইম আপডেট)
 *   localStorage মিরর  ←—— সিঙ্ক্রোনাস রিড/রাইট লেয়ার (সব UI হুক এটাই পড়ে)
 *
 * • প্রথম রানে RTDB ফাঁকা থাকলে লোকাল সিড ডেটা RTDB-তে বসে যায় (ওয়ান-টাইম বুটস্ট্র্যাপ)
 * • অফলাইনে লেখা RTDB SDK-র কিউতে থাকে, সংযোগ এলে অটো সিঙ্ক হয়
 * • লুপ-প্রোটেকশন: শেষ সিঙ্ক-কৃাত JSON এক হলে push হয় না
 * • স্ট্যাটাস: connecting | online | offline | error — অ্যাডমিন সেটিংসে দেখানো হয়
 */
import { useSyncExternalStore } from 'react';
import { ref, onValue, set as rtdbSet } from 'firebase/database';
import { firebaseDb } from '@/lib/firebase/app';
import { db, encodeForRtdb } from './core';
import type { DBData } from './types';

export type CloudStatus = 'connecting' | 'online' | 'offline' | 'error';

export type CloudState = {
  status: CloudStatus;
  ready: boolean;          // প্রথম রিমোট স্ন্যাপশট/চূড়ান্ত এরর এসেছে
  error: string | null;
  lastSyncAt: number | null;
};

const SERVER_CLOUD_STATE: CloudState = { status: 'connecting', ready: false, error: null, lastSyncAt: null };

let state: CloudState = { status: 'connecting', ready: false, error: null, lastSyncAt: null };
const listeners = new Set<() => void>();

/** React হুক — ক্লাউড সিঙ্ক স্ট্যাটাস (অ্যাডমিন সেটিংসে ব্যবহৃত) */
export function useCloudState(): CloudState {
  return useSyncExternalStore(subscribeCloud, getCloudState, () => SERVER_CLOUD_STATE);
}

export function getCloudState(): CloudState {
  return state;
}

export function subscribeCloud(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function setCloudState(patch: Partial<CloudState>): void {
  state = { ...state, ...patch };
  for (const l of Array.from(listeners)) {
    try {
      l();
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tsb:cloud', { detail: state }));
  }
}

/** ক্লাউড রেডি না হলে অপেক্ষা (অ্যাডমিন গেট বুটস্ট্র্যাপে ব্যবহার হয়) */
export function waitForCloudReady(timeoutMs = 8000): Promise<CloudState> {
  if (state.ready) return Promise.resolve(state);
  return new Promise((resolve) => {
    const timer = setTimeout(finish, timeoutMs);
    const unsub = subscribeCloud(() => {
      if (state.ready) finish();
    });
    function finish() {
      clearTimeout(timer);
      unsub();
      resolve(state);
    }
  });
}

// ───────────────────────────── ইঞ্জিন ─────────────────────────────

const ROOT = 'shop';
const PUSH_DEBOUNCE = 800;
const RETRY_MS = 15000;

let initialized = false;
let applyingRemote = false;
let remoteReady = false;
let firstSnapshotDone = false;
let lastSyncedJson = '';
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let detachRemote: (() => void) | null = null;
let attachTimer: ReturnType<typeof setInterval> | null = null;

function schedulePush(): void {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, PUSH_DEBOUNCE);
}

async function pushNow(): Promise<void> {
  const rtdb = firebaseDb();
  if (!rtdb || !remoteReady) return;
  const json = JSON.stringify(db.get());
  if (json === lastSyncedJson) return;
  try {
    // RTDB-তে পুরো ট্রি লেখা হয় — সাইজ এই অ্যাপের স্কেলে সম্পূর্ণ ঠিক আছে।
    // খালি অ্যারে সেন্টিনেল ({"__empty":true}) হিসেবে যায় — RTDB রাউন্ড-ট্রিপে
    // "ইচ্ছাকৃত খালি কালেকশন" হারিয়ে seed ডেটা ফিরে আসার বাগ বন্ধ হয়।
    await rtdbSet(ref(rtdb, ROOT), encodeForRtdb(JSON.parse(json)) as Record<string, unknown>);
    lastSyncedJson = json;
    if (state.status !== 'online' || state.error) {
      setCloudState({ status: 'online', error: null, lastSyncAt: Date.now() });
    } else {
      state = { ...state, lastSyncAt: Date.now() };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setCloudState({ status: 'error', error: msg.includes('Permission denied') ? 'RTDB Rules: পারমিশন নেই' : msg });
    if (!retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void pushNow();
      }, RETRY_MS);
    }
  }
}

function applyRemoteSnapshot(val: unknown): void {
  if (val == null || typeof val !== 'object') return;
  applyingRemote = true;
  try {
    db.applyRemote(val as Partial<DBData>);
  } finally {
    applyingRemote = false;
  }
  lastSyncedJson = JSON.stringify(db.get());
  setCloudState({ status: 'online', ready: true, error: null, lastSyncAt: Date.now() });
}

function attachRemote(): void {
  const rtdb = firebaseDb();
  if (!rtdb) return;
  detachRemote?.();
  const nodeRef = ref(rtdb, ROOT);
  const unsub = onValue(
    nodeRef,
    (snap) => {
      const val = snap.val();
      if (val == null) {
        // প্রথম রান — RTDB ফাঁকা: লোকাল ডেটা (সিড) ক্লাউডে বুটস্ট্র্যাপ হয়
        remoteReady = true;
        firstSnapshotDone = true;
        void pushNow();
        setCloudState({ ready: true, status: 'online' });
        return;
      }

      if (!firstSnapshotDone) {
        // লোডের প্রথম স্ন্যাপশট — রিমোটই সোর্স অব ট্রুথ, লোকাল মিরর রিপ্লেস হয়
        firstSnapshotDone = true;
        remoteReady = true;
        applyRemoteSnapshot(val);
        return;
      }

      // পরবর্তী স্ন্যাপশট — লোকালে আন-পুশড পরিবর্তন থাকলে রিমোট প্রয়োগ করা যাবে না
      // (নইলে লোকাল লেখা হারিয়ে যায়) — আগে লোকাল অবস্থাই push করা হয়
      const localJson = JSON.stringify(db.get());
      if (localJson !== lastSyncedJson) {
        remoteReady = true;
        void pushNow();
        return;
      }

      remoteReady = true;
      applyRemoteSnapshot(val);
    },
    (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      const denied = msg.includes('Permission denied');
      setCloudState({
        status: 'error',
        ready: true, // এরর হলেও UI লোকাল ডেটা নিয়ে চলবে (অফলাইন-ফার্স্ট)
        error: denied
          ? 'Realtime Database Rules পারমিশন দেয় না — Firebase Console-এ Rules ঠিক করুন'
          : msg,
      });
    }
  );
  detachRemote = unsub;
}

/** অ্যাপ চালু হলে একবারই কল হয় (CloudProvider থেকে) */
export function initCloudSync(): () => void {
  if (typeof window === 'undefined' || initialized) return () => undefined;
  initialized = true;

  const rtdb = firebaseDb();
  if (!rtdb) return () => undefined;

  // সংযোগ স্টেট
  const connRef = ref(rtdb, '.info/connected');
  const unsubConn = onValue(connRef, (snap) => {
    const connected = snap.val() === true;
    if (!connected) {
      if (state.status !== 'error') setCloudState({ status: 'offline' });
    } else if (state.status === 'offline' || state.status === 'connecting') {
      setCloudState({ status: remoteReady ? 'online' : 'connecting' });
    }
  });

  // লোকাল মিউটেশন → ক্লাউডে push (রিমোট-প্রয়োগ হলে স্কিপ)
  const unsubLocal = db.subscribe(() => {
    if (applyingRemote || !remoteReady) return;
    schedulePush();
  });

  attachRemote();

  // Rules পরে ঠিক করলেও নিজে থেকেই আবার চেষ্টা করবে
  attachTimer = setInterval(() => {
    if (state.status === 'error') attachRemote();
  }, 30000);

  return () => {
    unsubConn();
    unsubLocal();
    detachRemote?.();
    if (attachTimer) clearInterval(attachTimer);
    if (pushTimer) clearTimeout(pushTimer);
    if (retryTimer) clearTimeout(retryTimer);
    initialized = false;
  };
}

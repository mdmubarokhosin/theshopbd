/**
 * THE SHOP BD — GitHub রিপো হোস্টিং সার্ভিস
 * ---------------------------------------------------------------------------
 * ইমেজ/ভিডিও আপলোডের জন্য Firestore/Storage নয় — GitHub repo API ব্যবহার হয়:
 *
 *   আপলোড : GitHub Contents API (PUT /repos/{owner}/{repo}/contents/{path})
 *   লোড   : jsDelivr CDN (https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path})
 *
 * • GitHub কনফিগ (owner/repo/branch/folder/token) Firebase RTDB-র settings-এ থাকে
 *   এবং অ্যাডমিন প্যানেল → সেটিংস → GitHub হোস্টিং পেজ থেকে সেট/চেক করা যায়
 * • ছবি ক্লায়েন্ট-সাইডে কমপ্রেস করে আপলোড হয় (ডেটা ও ব্যান্ডউইথ বাঁচে)
 * • ভিডিও সরাসরি আপলোড হয় (GitHub লিমিট: ফাইল ≤ ১০০MB; jsDelivr ≤ ২০MB ক্যাশ)
 */

import { db } from './core';
import type { SiteSettings } from './types';

export type GithubConfig = {
  owner: string;
  repo: string;
  branch: string;
  folder: string;
  token: string;
};

export type GithubTestResult = {
  ok: boolean;
  repoOk: boolean;
  branchOk: boolean;
  jsDelivrOk: boolean;
  message: string;
  repoUrl?: string;
  cdnBase?: string;
};

/** RTDB settings থেকে GitHub কনফিগ */
export function getGithubConfig(): GithubConfig {
  const s = db.get().settings;
  return {
    owner: (s.github_owner || '').trim(),
    repo: (s.github_repo || '').trim(),
    branch: (s.github_branch || 'main').trim() || 'main',
    folder: (s.github_folder || 'uploads').replace(/^\/+|\/+$/g, '') || 'uploads',
    token: (s.github_token || '').trim(),
  };
}

export function isGithubConfigured(): boolean {
  const c = getGithubConfig();
  return !!(c.owner && c.repo && c.token);
}

function apiHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/** সংযোগ পরীক্ষা — রিপো + ব্রাঞ্চ + jsDelivr তিনটাই চেক করে */
export async function testGithubConnection(cfg?: GithubConfig): Promise<GithubTestResult> {
  const c = cfg ?? getGithubConfig();
  if (!c.owner || !c.repo) {
    return { ok: false, repoOk: false, branchOk: false, jsDelivrOk: false, message: 'Owner ও Repository নাম দিন' };
  }
  const repoUrl = `https://github.com/${c.owner}/${c.repo}`;
  const cdnBase = `https://cdn.jsdelivr.net/gh/${c.owner}/${c.repo}@${c.branch}`;
  const headers: HeadersInit = c.token ? apiHeaders(c.token) : { Accept: 'application/vnd.github+json' };

  // ১) রিপো আছে কি?
  let repoOk = false;
  let privateRepo = false;
  try {
    const res = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}`, { headers });
    repoOk = res.ok;
    if (res.ok) {
      const data = (await res.json()) as { private?: boolean };
      privateRepo = !!data.private;
    } else if (res.status === 404) {
      return { ok: false, repoOk: false, branchOk: false, jsDelivrOk: false, message: 'রিপোজিটরি পাওয়া যায়নি — owner/repo নাম ও টোকেন পারমিশন দেখুন', repoUrl };
    } else if (res.status === 401) {
      return { ok: false, repoOk: false, branchOk: false, jsDelivrOk: false, message: 'টোকেন অবৈধ বা মেয়াদ শেষ — নতুন PAT দিন', repoUrl };
    }
  } catch {
    return { ok: false, repoOk: false, branchOk: false, jsDelivrOk: false, message: 'ইন্টারনেট সংযোগ পরীক্ষা করুন', repoUrl };
  }

  // ২) ব্রাঞ্চ আছে কি?
  let branchOk = false;
  try {
    const res = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/branches/${encodeURIComponent(c.branch)}`, { headers });
    branchOk = res.ok;
  } catch {
    // ignore
  }

  // ৩) jsDelivr CDN চেক (পাবলিক রিপো হলেই কাজ করে)
  let jsDelivrOk = false;
  if (!privateRepo) {
    try {
      const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${c.owner}/${c.repo}@${c.branch}`, { cache: 'no-store' });
      jsDelivrOk = res.ok;
    } catch {
      // ignore
    }
  }

  if (!branchOk) {
    return { ok: false, repoOk: true, branchOk: false, jsDelivrOk, message: `রিপো ঠিক আছে, কিন্তু "${c.branch}" ব্রাঞ্চ পাওয়া যায়নি`, repoUrl, cdnBase };
  }
  if (privateRepo) {
    return { ok: false, repoOk: true, branchOk: true, jsDelivrOk: false, message: 'প্রাইভেট রিপো — jsDelivr পাবলিক লোড পারবে না। রিপোটি Public করুন', repoUrl };
  }
  return {
    ok: true,
    repoOk,
    branchOk,
    jsDelivrOk,
    message: jsDelivrOk
      ? 'সব ঠিক আছে — রিপো, ব্রাঞ্চ ও jsDelivr CDN কাজ করছে ✓'
      : 'সংযোগ ঠিক আছে; jsDelivr ইনডেক্স হতে কিছুক্ষণ লাগতে পারে (নতুন রিপো হলে)',
    repoUrl,
    cdnBase,
  };
}

// ───────────────────────────── আপলোড ─────────────────────────────

export class GithubNotConfiguredError extends Error {
  constructor() {
    super('GitHub হোস্টিং কনফিগার করা হয়নি — সেটিংস → GitHub হোস্টিং থেকে সেট করুন');
    this.name = 'GithubNotConfiguredError';
  }
}

function dataUrlToBase64(dataUrl: string): { base64: string; mime: string } {
  const [meta, b64 = ''] = dataUrl.split(',');
  const mime = meta?.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  return { base64: b64, mime };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error('ফাইল পড়া যায়নি'));
    reader.readAsDataURL(blob);
  });
}

function extFromMime(mime: string, fallback: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  return map[mime] || fallback.replace(/[^a-z0-9]/gi, '') || 'bin';
}

function randomTag(): string {
  return Math.random().toString(36).slice(2, 8);
}

function safeName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9\u0980-\u09FF]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'file'
  );
}

export type UploadKind = 'image' | 'video' | 'file';

export type UploadResult = {
  ok: boolean;
  url?: string;          // jsDelivr CDN URL (সাইটে এটাই ব্যবহৃত হয়)
  rawUrl?: string;       // raw.githubusercontent.com ফলব্যাক
  path?: string;
  error?: string;
};

/**
 * ডেটা URL (কমপ্রেস করা ছবি) GitHub রিপোতে আপলোড → jsDelivr URL রিটার্ন
 * @param subFolder  যেমন: products | banners | avatars | proofs
 */
export async function uploadDataUrlToGithub(dataUrl: string, fileName: string, subFolder: string): Promise<UploadResult> {
  const c = getGithubConfig();
  if (!isGithubConfigured()) return { ok: false, error: 'GitHub হোস্টিং কনফিগার করা হয়নি' };

  const { base64, mime } = dataUrlToBase64(dataUrl);
  if (!base64) return { ok: false, error: 'ফাইল কনটেন্ট পড়া যায়নি' };
  return putToGithub(base64, mime, fileName, subFolder, c);
}

/**
 * সরাসরি File/Blob আপলোড (ভিডিও/বড় ফাইল — কমপ্রেশন ছাড়া)
 */
export async function uploadFileToGithub(file: File | Blob, fileName: string, subFolder: string): Promise<UploadResult> {
  const c = getGithubConfig();
  if (!isGithubConfigured()) return { ok: false, error: 'GitHub হোস্টিং কনফিগার করা হয়নি' };

  const MAX_BYTES = 90 * 1024 * 1024; // GitHub Contents API নিরাপদ সীমা
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'ফাইল খুব বড় (সর্বোচ্চ ৯০MB)' };
  }
  const base64 = await blobToBase64(file);
  const mime = file.type || 'application/octet-stream';
  return putToGithub(base64, mime, fileName, subFolder, c);
}

async function putToGithub(base64: string, mime: string, fileName: string, subFolder: string, c: GithubConfig): Promise<UploadResult> {
  const d = new Date();
  const yyyyMm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const ext = extFromMime(mime, fileName.split('.').pop() || 'bin');
  const path = `${c.folder}/${subFolder || 'misc'}/${yyyyMm}/${safeName(fileName)}-${randomTag()}.${ext}`;
  const apiUrl = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`;

  try {
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: apiHeaders(c.token),
      body: JSON.stringify({
        message: `upload: ${path} (THE SHOP BD)`,
        content: base64,
        branch: c.branch,
      }),
    });
    if (!res.ok) {
      if (res.status === 401) return { ok: false, error: 'GitHub টোকেন অবৈধ — নতুন PAT দিন' };
      if (res.status === 403) return { ok: false, error: 'টোকেনে লেখার পারমিশন নেই (Contents: Read & Write দিন)' };
      if (res.status === 404) return { ok: false, error: 'রিপো/ব্রাঞ্চ পাওয়া যায়নি — GitHub সেটিংস দেখুন' };
      if (res.status === 422) return { ok: false, error: 'ফাইল কনফ্লিক্ট — আবার চেষ্টা করুন' };
      const text = await res.text().catch(() => '');
      return { ok: false, error: `GitHub আপলোড ব্যর্থ (${res.status}) ${text.slice(0, 120)}` };
    }
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${c.owner}/${c.repo}@${c.branch}/${path}`;
    const rawUrl = `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch}/${path}`;
    return { ok: true, url: cdnUrl, rawUrl, path };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে' };
  }
}

/** সুবিধা-ফাংশন: ছবি কমপ্রেস করে (image-tools) আপলোড — এক কলে jsDelivr URL */
export async function uploadImageToHosting(
  dataUrl: string,
  fileName: string,
  subFolder: string
): Promise<UploadResult> {
  if (!isGithubConfigured()) {
    // কনফিগার না থাকলে কলার dataURL-ফলব্যাক ব্যবহার করবে (সাইট ভাঙবে না)
    return { ok: false, error: 'github_not_configured' };
  }
  return uploadDataUrlToGithub(dataUrl, fileName, subFolder);
}

/** সেটিংসে GitHub কনফিগ সেভ (RTDB-তে সিঙ্ক হয়) */
export function saveGithubConfig(patch: Partial<Pick<SiteSettings, 'github_owner' | 'github_repo' | 'github_branch' | 'github_folder' | 'github_token'>>): void {
  db.updateSettings(patch);
}

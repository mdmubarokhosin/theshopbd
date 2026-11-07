/**
 * বাংলাদেশ জিও ডেটা — ক্লায়েন্ট হেল্পার
 * ---------------------------------------------------------------------------
 * unifiedapi (github.com/mdmubarokhosin/unifiedapi) থেকে নেওয়া স্ট্যাটিক
 * বাংলাদেশ জিও ডেটা — প্রজেক্টের ভেতরেই API রুট দিয়ে সার্ভ হয়:
 *   /api/geo/divisions  → ৮ বিভাগ
 *   /api/geo/districts?division_id=  → জেলা
 *   /api/geo/upazilas?district_id=   → থানা/উপজেলা
 *   /api/geo/unions?upazila_id=      → ইউনিয়ন
 *
 * ইন-মেমরি ক্যাশ: একবার লোড হলে পরে আর নেটওয়ার্ক কল হয় না।
 */

export type GeoDivision = { id: string; name: string; bn_name: string };
export type GeoDistrict = { id: string; division_id: string; name: string; bn_name: string };
export type GeoUpazila = { id: string; district_id: string; name: string; bn_name: string };
export type GeoUnion = { id: string; upazila_id: string; name: string; bn_name: string };

type CacheEntry = unknown[];
const cache = new Map<string, CacheEntry>();

async function load<T>(url: string): Promise<T[]> {
  const hit = cache.get(url);
  if (hit) return hit as T[];
  const res = await fetch(url);
  const json = (await res.json()) as { ok: boolean; data: T[] };
  const data = json.ok && Array.isArray(json.data) ? json.data : [];
  cache.set(url, data as unknown[]);
  return data;
}

/** সব বিভাগ (৮টি) — প্রথম কলে লোড, পরে ক্যাশ */
export function loadDivisions(): Promise<GeoDivision[]> {
  return load<GeoDivision>('/api/geo/divisions');
}

/** নির্দিষ্ট বিভাগের জেলাগুলো */
export function loadDistricts(divisionId: string): Promise<GeoDistrict[]> {
  return load<GeoDistrict>(`/api/geo/districts?division_id=${encodeURIComponent(divisionId)}`);
}

/** নির্দিষ্ট জেলার থানা/উপজেলাগুলো */
export function loadUpazilas(districtId: string): Promise<GeoUpazila[]> {
  return load<GeoUpazila>(`/api/geo/upazilas?district_id=${encodeURIComponent(districtId)}`);
}

/** নির্দিষ্ট থানার ইউনিয়নগুলো */
export function loadUnions(upazilaId: string): Promise<GeoUnion[]> {
  return load<GeoUnion>(`/api/geo/unions?upazila_id=${encodeURIComponent(upazilaId)}`);
}

/** সব জেলা (৬৪টি) — নাম-ম্যাচ রিহাইড্রেশনের জন্য */
export function loadAllDistricts(): Promise<GeoDistrict[]> {
  return load<GeoDistrict>('/api/geo/districts');
}

// ── নাম-ম্যাচ হেল্পার (সেভ করা ঠিকানা খুললে আবার সিলেক্ট রিহাইড্রেট করতে) ──

export function eqBn(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = a.trim();
  const nb = b.trim();
  return na === nb;
}

/** বাংলা/ইংরেজি নাম দিয়ে জেলা খুঁজুন */
export function matchDistrict(list: GeoDistrict[], district: string | null | undefined): GeoDistrict | null {
  if (!district?.trim()) return null;
  const q = district.trim().toLowerCase();
  return (
    list.find((d) => eqBn(d.bn_name, district)) ||
    list.find((d) => d.name.toLowerCase() === q) ||
    null
  );
}

/** বাংলা/ইংরেজি নাম দিয়ে থানা খুঁজুন */
export function matchUpazila(list: GeoUpazila[], upazila: string | null | undefined): GeoUpazila | null {
  if (!upazila?.trim()) return null;
  const q = upazila.trim().toLowerCase();
  return (
    list.find((u) => eqBn(u.bn_name, upazila)) ||
    list.find((u) => u.name.toLowerCase() === q) ||
    null
  );
}

/** বাংলা/ইংরেজি নাম দিয়ে ইউনিয়ন খুঁজুন */
export function matchUnion(list: GeoUnion[], union: string | null | undefined): GeoUnion | null {
  if (!union?.trim()) return null;
  const q = union.trim().toLowerCase();
  return (
    list.find((u) => eqBn(u.bn_name, union)) ||
    list.find((u) => u.name.toLowerCase() === q) ||
    null
  );
}

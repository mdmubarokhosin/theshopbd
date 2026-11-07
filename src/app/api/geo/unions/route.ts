/**
 * বাংলাদেশ জিও ডেটা API — ইউনিয়ন (Union)
 *
 * GET /api/geo/unions?upazila_id=1   (ঐচ্ছিক ফিল্টার)
 * → { ok: true, data: Union[], count }
 */
import { NextRequest, NextResponse } from 'next/server';
import unionsData from '@/data/geo/unions.json';

export type GeoUnion = {
  id: string;
  upazila_id: string;
  name: string;
  bn_name: string;
};

const unions = unionsData as GeoUnion[];

export async function GET(request: NextRequest) {
  const upazilaId = request.nextUrl.searchParams.get('upazila_id');
  const data = upazilaId
    ? unions.filter((u) => u.upazila_id === upazilaId)
    : unions;
  return NextResponse.json({ ok: true, data, count: data.length });
}

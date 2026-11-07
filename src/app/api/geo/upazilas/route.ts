/**
 * বাংলাদেশ জিও ডেটা API — থানা/উপজেলা (Upazila)
 *
 * GET /api/geo/upazilas?district_id=1   (ঐচ্ছিক ফিল্টার)
 * → { ok: true, data: Upazila[], count }
 */
import { NextRequest, NextResponse } from 'next/server';
import upazilasData from '@/data/geo/upazilas.json';

export type GeoUpazila = {
  id: string;
  district_id: string;
  name: string;
  bn_name: string;
};

const upazilas = upazilasData as GeoUpazila[];

export async function GET(request: NextRequest) {
  const districtId = request.nextUrl.searchParams.get('district_id');
  const data = districtId
    ? upazilas.filter((u) => u.district_id === districtId)
    : upazilas;
  return NextResponse.json({ ok: true, data, count: data.length });
}

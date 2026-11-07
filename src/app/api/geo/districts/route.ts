/**
 * বাংলাদেশ জিও ডেটা API — জেলা (District)
 *
 * GET /api/geo/districts?division_id=6   (ঐচ্ছিক ফিল্টার)
 * → { ok: true, data: District[], count }
 */
import { NextRequest, NextResponse } from 'next/server';
import districtsData from '@/data/geo/districts.json';

export type GeoDistrict = {
  id: string;
  division_id: string;
  name: string;
  bn_name: string;
};

const districts = districtsData as GeoDistrict[];

export async function GET(request: NextRequest) {
  const divisionId = request.nextUrl.searchParams.get('division_id');
  const data = divisionId
    ? districts.filter((d) => d.division_id === divisionId)
    : districts;
  return NextResponse.json({ ok: true, data, count: data.length });
}

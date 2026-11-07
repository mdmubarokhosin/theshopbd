/**
 * বাংলাদেশ জিও ডেটা API — বিভাগ (Division)
 * উৎস: unifiedapi (github.com/mdmubarokhosin/unifiedapi) — স্ট্যাটিক JSON
 *
 * GET /api/geo/divisions
 * → { ok: true, data: Division[], count }
 */
import { NextResponse } from 'next/server';
import divisionsData from '@/data/geo/divisions.json';

export type GeoDivision = { id: string; name: string; bn_name: string };

const divisions = divisionsData as GeoDivision[];

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: divisions,
    count: divisions.length,
  });
}

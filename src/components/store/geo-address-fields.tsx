'use client';

/**
 * জিও অ্যাড্রেস ফিল্ডস — বিভাগ → জেলা → থানা → ইউনিয়ন অটো ক্যাসকেড ড্রপডাউন
 * ---------------------------------------------------------------------------
 * unifiedapi ডেটা ভিত্তিক। ব্যবহার:
 *   <GeoAddressFields
 *     value={{ division, district, city, area }}   // বাংলা নামসমূহ
 *     onChange={(v) => setForm(...)}
 *   />
 *
 * আর্কিটেকচার (পিওর-ডেরাইভড):
 * • সিলেকশন আইডি কোনো স্টেটে রাখা হয় না — value-র নাম থেকে প্রতি রেন্ডারে ডেরাইভ হয়,
 *   তাই বাইরের ভ্যালু বদলালে (সেভ করা ঠিকানা সিলেক্ট) ড্রপডাউন অটো-রিহাইড্রেট হয়।
 * • ইফেক্ট শুধু লিস্ট লোড করে (divisions/districts/upazilas/unions) — ইফেক্টের
 *   ভেতরে কোনো সিঙ্ক সেটস্টেট নেই।
 * • বিভাগ বদলালে পুরোনো লিস্ট স্টেল হয়, ডেরাইভড আইডি '' হয়ে প্লেসহোল্ডার দেখায়।
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  loadDivisions, loadDistricts, loadUpazilas, loadUnions,
  matchDistrict, matchUpazila, matchUnion,
  type GeoDivision, type GeoDistrict, type GeoUpazila, type GeoUnion,
} from '@/lib/geo';
import { cn } from '@/lib/utils';

export type GeoValue = {
  division: string;
  district: string;
  city: string;      // থানা/উপজেলা নাম
  area: string;      // ইউনিয়ন নাম
};

type Props = {
  value: GeoValue;
  onChange: (v: GeoValue) => void;
  /** সত্য হলে ইউনিয়ন ঐচ্ছিক ("প্রযোজ্য নয়" অপশন সহ) */
  optionalUnion?: boolean;
  className?: string;
};

export function GeoAddressFields({ value, onChange, optionalUnion = false, className }: Props) {
  const [divisions, setDivisions] = useState<GeoDivision[] | null>(null);
  const [districts, setDistricts] = useState<GeoDistrict[]>([]);
  const [upazilas, setUpazilas] = useState<GeoUpazila[]>([]);
  const [unions, setUnions] = useState<GeoUnion[]>([]);

  // onChange রেফ — ইফেক্টে সিঙ্ক (রেন্ডারে ref লেখা নিষিদ্ধ)
  const onChangeRef = useRefLatest(onChange);

  // বিভাগ লিস্ট — মাউন্টে একবার
  useEffect(() => {
    let alive = true;
    loadDivisions()
      .then((d) => { if (alive) setDivisions(d); })
      .catch(() => { if (alive) setDivisions([]); });
    return () => { alive = false; };
  }, []);

  // ডেরাইভড আইডি — value নাম থেকে (বাংলা/ইংরেজি দুটোই ম্যাচ করে)
  const divisionId = useMemo(
    () => divisions?.find((d) => d.bn_name === value.division || d.name === value.division)?.id ?? '',
    [divisions, value.division]
  );
  const districtId = useMemo(
    () => matchDistrict(districts, value.district)?.id ?? '',
    [districts, value.district]
  );
  const upazilaId = useMemo(
    () => matchUpazila(upazilas, value.city)?.id ?? '',
    [upazilas, value.city]
  );
  const unionId = useMemo(
    () => matchUnion(unions, value.area)?.id ?? '',
    [unions, value.area]
  );

  // লিস্ট লোড — ডেরাইভড আইডি বদলালে (পিওর লোডিং ইফেক্ট, কোনো সিঙ্ক সেটস্টেট নেই)
  useEffect(() => {
    if (!divisionId) return;
    if (districts.length > 0 && districts[0].division_id === divisionId) return;
    let alive = true;
    loadDistricts(divisionId)
      .then((d) => { if (alive) setDistricts(d); })
      .catch(() => { if (alive) setDistricts([]); });
    return () => { alive = false; };
  }, [divisionId]);

  useEffect(() => {
    if (!districtId) return;
    if (upazilas.length > 0 && upazilas[0].district_id === districtId) return;
    let alive = true;
    loadUpazilas(districtId)
      .then((u) => { if (alive) setUpazilas(u); })
      .catch(() => { if (alive) setUpazilas([]); });
    return () => { alive = false; };
  }, [districtId]);

  useEffect(() => {
    if (!upazilaId) return;
    if (unions.length > 0 && unions[0].upazila_id === upazilaId) return;
    let alive = true;
    loadUnions(upazilaId)
      .then((u) => { if (alive) setUnions(u); })
      .catch(() => { if (alive) setUnions([]); });
    return () => { alive = false; };
  }, [upazilaId]);

  // লোডিং — পিওর ডেরাইভেশন (লিস্ট এখনো লোড হয়নি কি না)
  const districtsLoading = !!divisionId && districts[0]?.division_id !== divisionId;
  const upazilasLoading = !!districtId && upazilas[0]?.district_id !== districtId;
  const unionsLoading = !!upazilaId && unions[0]?.upazila_id !== upazilaId;

  // পিক হ্যান্ডলার — শুধু নাম আপডেট করে onChange-এ পাঠায়; আইডি নিজে থেকেই ডেরাইভ হবে
  const pickDivision = (id: string) => {
    const d = divisions?.find((x) => x.id === id);
    onChangeRef.current({ division: d?.bn_name || '', district: '', city: '', area: '' });
  };
  const pickDistrict = (id: string) => {
    const d = districts.find((x) => x.id === id);
    onChangeRef.current({ division: value.division, district: d?.bn_name || '', city: '', area: '' });
  };
  const pickUpazila = (id: string) => {
    const u = upazilas.find((x) => x.id === id);
    onChangeRef.current({ division: value.division, district: value.district, city: u?.bn_name || '', area: '' });
  };
  const pickUnion = (id: string) => {
    if (id === '__none__') {
      onChangeRef.current({ division: value.division, district: value.district, city: value.city, area: '' });
      return;
    }
    const u = unions.find((x) => x.id === id);
    onChangeRef.current({ division: value.division, district: value.district, city: value.city, area: u?.bn_name || '' });
  };

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
      {/* বিভাগ */}
      <div>
        <Label>বিভাগ <span className="text-destructive">*</span></Label>
        <Select value={divisionId} onValueChange={pickDivision}>
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue placeholder={divisions === null ? 'লোড হচ্ছে…' : 'বিভাগ নির্বাচন করুন'} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {divisions?.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.bn_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* জেলা */}
      <div>
        <Label>জেলা <span className="text-destructive">*</span></Label>
        <Select value={districtId} onValueChange={pickDistrict} disabled={!divisionId}>
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue placeholder={districtsLoading ? 'লোড হচ্ছে…' : divisionId ? 'জেলা নির্বাচন করুন' : 'প্রথমে বিভাগ বাছুন'} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.bn_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* থানা / উপজেলা */}
      <div>
        <Label>থানা / উপজেলা <span className="text-destructive">*</span></Label>
        <Select value={upazilaId} onValueChange={pickUpazila} disabled={!districtId}>
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue placeholder={upazilasLoading ? 'লোড হচ্ছে…' : districtId ? 'থানা / উপজেলা নির্বাচন করুন' : 'প্রথমে জেলা বাছুন'} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {upazilas.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.bn_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ইউনিয়ন */}
      <div>
        <Label>
          ইউনিয়ন {optionalUnion ? <span className="text-xs text-muted-foreground">(ঐচ্ছিক)</span> : <span className="text-destructive">*</span>}
        </Label>
        <Select value={unionId} onValueChange={pickUnion} disabled={!upazilaId}>
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue placeholder={unionsLoading ? 'লোড হচ্ছে…' : upazilaId ? 'ইউনিয়ন নির্বাচন করুন' : 'প্রথমে থানা বাছুন'} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {optionalUnion && (
              <SelectItem value="__none__">প্রযোজ্য নয়</SelectItem>
            )}
            {unions.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.bn_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* বর্তমান সিলেকশন সারাংশ */}
      {(value.district || value.city || value.area) && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground sm:col-span-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="break-words">
            {[value.division, value.district, value.city, value.area].filter(Boolean).join(' → ') || '—'}
          </span>
        </div>
      )}
    </div>
  );
}

/** সবসময় সর্বশেষ কলব্যাক ধারণ করা রেফ (রেন্ডারে ref লেখা হয় না) */
function useRefLatest<T>(value: T) {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

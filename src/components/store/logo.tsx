'use client';

import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/db/hooks';

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  const settings = useSettings();
  const siteTitle = settings.site_title || 'THE SHOP BD';
  const siteTagline = settings.site_tagline || 'মাল্টিব্র্যান্ড অনলাইন শপিং';
  const siteLogo = settings.site_logo;

  // Split "THE SHOP BD" style titles: last word highlighted with honey color
  const parts = siteTitle.split(' ');
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : siteTitle;
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const badgeLetter = (siteTitle.trim()[0] || 'S').toUpperCase();

  return (
    <div className={cn('flex items-center gap-2 select-none', className)}>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
        {siteLogo ? (

          <img src={siteLogo} alt={siteTitle} className="h-full w-full rounded-xl object-cover" />
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* shopping bag — নিরপেক্ষ শপ আইকন */}
              <path d="M6 7h12l1.2 12.2a2 2 0 0 1-2 2.2H6.8a2 2 0 0 1-2-2.2L6 7Z" />
              <path d="M9 10V6a3 3 0 0 1 6 0v4" />
            </svg>
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-honey text-[9px] font-bold text-white shadow">{badgeLetter}</span>
          </>
        )}
      </div>
      {/* মোবাইলে শুধু লোগো মার্ক — টাইটেল/সাবটাইটেল sm ব্রেকপয়েন্ট থেকে দেখাবে (হেডার ওভারফ্লো ফিক্স) */}
      <div className="hidden min-w-0 leading-none sm:block">
        <div className={cn('truncate text-lg font-extrabold tracking-tight sm:text-xl', light ? 'text-white' : 'text-primary')}>
          {last ? (
            <>
              {first} <span className="text-honey">{last}</span>
            </>
          ) : (
            siteTitle
          )}
        </div>
        <div className={cn('mt-0.5 truncate text-[10px] font-medium tracking-[0.08em]', light ? 'text-white/70' : 'text-muted-foreground')}>
          {siteTagline}
        </div>
      </div>
    </div>
  );
}

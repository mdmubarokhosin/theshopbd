'use client';

/**
 * ফুটার — ব্র্যান্ড কালার থিম (গাঢ় গ্রিন + হানি অ্যাকসেন্ট)
 * ─────────────────────────────────────────────────────────────────────
 * • গাঢ় ব্র্যান্ড-গ্রিন গ্রেডিয়েন্ট ব্যাকগ্রাউন্ড + হানি (honey) অ্যাকসেন্ট
 * • উপরে হানি → গ্রিন গ্রেডিয়েন্ট ব্র্যান্ড স্ট্রিপ
 * • ডট প্যাটার্ন + সফট গ্লো + ওয়াটারমার্ক শপিং-ব্যাগ ডেকোরেশন
 * • ৩ কলাম: ব্র্যান্ড লকআপ + Call us পিল + সোশ্যাল | Important Links | Stay Connected
 * • নিচের বার: © টেক্সট (বাম) + Cash on delivery (ডান, শেষ শব্দ হানি)
 * • সবকিছু অ্যাডমিন সেটিংস থেকে ডায়নামিক (নাম, লোগো, ট্যাগলাইন, ফোন, ঠিকানা,
 *   ইমেইল, সময়সূচি, সোশ্যাল লিংক, COD টেক্সট)
 * • পাবলিক সাইটে কোনো অ্যাডমিন লিংক/হিন্ট নেই — অ্যাডমিন শুধু সরাসরি URL দিয়ে
 */

import { Phone, Mail, MapPin, Clock, Truck } from 'lucide-react';
import { useStore } from '@/lib/store';
import { BiIcon } from '@/lib/icons';

/** বাংলা সংখ্যা → ASCII (tel: লিংকের জন্য) */
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
function toEnDigits(s: string): string {
  return (s || '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

type Social = { icon: string; url: string; label: string; filled?: boolean };

export function Footer() {
  const navigate = useStore((s) => s.navigate);
  const settings = useStore((s) => s.siteSettings);

  const siteTitle = settings.site_title || 'THE SHOP BD';
  const siteTagline = settings.site_tagline || 'মাল্টিব্র্যান্ড অনলাইন শপিং';
  const siteLogo = settings.site_logo;

  // লোগো টাইটেল স্প্লিট — শেষ শব্দ হানি রঙে (হেডারের লোগোর মতোই)
  const titleParts = siteTitle.split(' ');
  const titleFirst = titleParts.length > 1 ? titleParts.slice(0, -1).join(' ') : '';
  const titleLast = titleParts.length > 1 ? titleParts[titleParts.length - 1] : siteTitle;

  // সোশ্যাল আইকন — কনফিগার করা গুলোই দেখাবে (FB হানি ভরাট, বাকি গ্লাস আউটলাইন)
  const socials: Social[] = [
    { icon: 'bi-facebook', url: settings.social_facebook, label: 'ফেসবুক', filled: true },
    { icon: 'bi-instagram', url: settings.social_instagram, label: 'ইনস্টাগ্রাম' },
    { icon: 'bi-whatsapp', url: settings.social_whatsapp, label: 'হোয়াটসঅ্যাপ' },
    { icon: 'bi-youtube', url: settings.social_youtube, label: 'ইউটিউব' },
  ].filter((s) => !!s.url);

  // গুরুত্বপূর্ণ লিংক
  const importantLinks = [
    { label: 'About Us', action: () => navigate({ name: 'info', page: 'about' }) },
    { label: 'Terms & Conditions', action: () => navigate({ name: 'info', page: 'terms' }) },
    { label: 'Privacy Policy', action: () => navigate({ name: 'info', page: 'privacy' }) },
    { label: 'Track Order', action: () => navigate({ name: 'track-order' }) },
  ];

  // COD টেক্সট — অ্যাডমিন বদলাতে পারে; শেষ শব্দটি হানি বোল্ড
  const codText = settings.footer_cod_text || 'Cash on delivery all over Bangladesh';
  const codWords = codText.trim().split(/\s+/);
  const codLast = codWords.pop() ?? '';

  return (
    <footer className="mt-auto">
      {/* ── হানি → ব্র্যান্ড-গ্রিন গ্রেডিয়েন্ট স্ট্রিপ ─────────────────── */}
      <div aria-hidden="true" className="footer-strip h-1 w-full" />

      <div className="footer-brand relative overflow-hidden">
        {/* ── ডেকোরেশন: ডট প্যাটার্ন + সফট গ্লো + ওয়াটারমার্ক ব্যাগ ── */}
        <div aria-hidden="true" className="footer-pattern absolute inset-0" />
        <div aria-hidden="true" className="absolute -top-28 -right-20 h-80 w-80 rounded-full bg-honey/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute -right-8 -bottom-10 h-56 w-56 rotate-12 text-white/[0.06] sm:h-72 sm:w-72"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 7h12l1.2 12.2a2 2 0 0 1-2 2.2H6.8a2 2 0 0 1-2-2.2L6 7Z" />
          <path d="M9 10V6a3 3 0 0 1 6 0v4" />
        </svg>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.45fr_0.9fr_1.15fr] lg:gap-12">
            {/* ── ব্র্যান্ড ─────────────────────────────────────────── */}
            <div>
              <button
                type="button"
                onClick={() => navigate({ name: 'home' })}
                className="flex items-center gap-3 text-left"
                aria-label={`${siteTitle} — হোমপেজে যান`}
              >
                {siteLogo ? (
                  <img
                    src={siteLogo}
                    alt={siteTitle}
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-xl bg-white/95 object-contain p-1 shadow-lg"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-honey shadow-lg shadow-honey/30">
                    {/* শপিং ব্যাগ — বিল্ট-ইন লোগো মার্ক */}
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 7h12l1.2 12.2a2 2 0 0 1-2 2.2H6.8a2 2 0 0 1-2-2.2L6 7Z" />
                      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
                    </svg>
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-2xl font-extrabold uppercase leading-tight tracking-tight text-white sm:text-[26px]">
                    {titleFirst ? (
                      <>
                        {titleFirst} <span className="text-honey">{titleLast}</span>
                      </>
                    ) : (
                      siteTitle
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-honey/90">
                    — {siteTagline} —
                  </span>
                </span>
              </button>

              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
                {settings.footer_about || settings.site_description}
              </p>

              {/* Call us পিল — গ্লাস স্টাইল + হানি ফোন বাটন */}
              <a
                href={`tel:${toEnDigits(settings.contact_phone)}`}
                className="mt-5 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 py-1.5 pl-1.5 pr-6 backdrop-blur-sm transition-colors hover:border-honey/60 hover:bg-white/15"
                aria-label={`কল করুন ${settings.contact_phone}`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-honey text-white shadow-md shadow-honey/30">
                  <Phone className="h-5 w-5" />
                </span>
                <span className="leading-tight">
                  <span className="block text-xs text-white/60">Call us</span>
                  <span className="block text-base font-bold text-white sm:text-lg">{settings.contact_phone}</span>
                </span>
              </a>

              {/* সোশ্যাল আইকন — FB হানি ভরাট, বাকি গ্লাস; হোভারে উল্টে যায় */}
              <div className="mt-5 flex items-center gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className={
                      s.filled
                        ? 'flex h-10 w-10 items-center justify-center rounded-full border border-honey bg-honey text-white shadow-md shadow-honey/25 transition-colors hover:border-white hover:bg-white hover:text-brand'
                        : 'flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:border-honey hover:bg-honey'
                    }
                  >
                    <BiIcon name={s.icon} className="text-lg" />
                  </a>
                ))}
              </div>
            </div>

            {/* ── Important Links ──────────────────────────────────── */}
            <nav aria-label="গুরুত্বপূর্ণ লিংক">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
                Important Links
              </h3>
              <span aria-hidden="true" className="mt-2 mb-4 block h-[3px] w-10 rounded-full bg-honey" />
              <ul className="space-y-3">
                {importantLinks.map((l) => (
                  <li key={l.label}>
                    <button
                      type="button"
                      onClick={l.action}
                      className="group flex items-center gap-2.5 text-[15px] text-white/75 transition-colors hover:text-honey"
                    >
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-honey/50 transition-all group-hover:scale-125 group-hover:bg-honey"
                      />
                      <span className="transition-transform group-hover:translate-x-0.5">{l.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* ── Stay Connected ───────────────────────────────────── */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
                Stay Connected
              </h3>
              <span aria-hidden="true" className="mt-2 mb-4 block h-[3px] w-10 rounded-full bg-honey" />
              <ul className="space-y-3.5 text-sm">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-honey">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="pt-2 text-white/75">{settings.contact_address}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-honey">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="pt-2">
                    <a
                      href={`mailto:${settings.contact_email}`}
                      className="break-all text-white/75 transition-colors hover:text-honey"
                    >
                      {settings.contact_email}
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-honey">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="pt-2 text-white/75">{settings.support_hours}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-honey">
                    <Truck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="pt-2 text-white/75">শুধুমাত্র বাংলাদেশে ক্যাশ অন ডেলিভারি</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── নিচের কপিরাইট বার — আরও গাঢ় গ্রিন ───────────────────────── */}
        <div className="footer-brand-deep relative z-10 border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 pb-24 pt-4 text-center text-sm text-white/65 sm:flex-row sm:text-left md:pb-4">
            <p>
              © {new Date().getFullYear()}{' '}
              <span className="font-semibold text-white/85">{siteTitle}</span>. All rights reserved.
            </p>
            <p>
              {codWords.join(' ')}{' '}
              <span className="font-bold text-honey">{codLast}</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

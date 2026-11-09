'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Megaphone, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useStore } from '@/lib/store';
import { useSettings } from '@/lib/db/hooks';

/**
 * Admin-controlled popups:
 *  - popup_notice: নোটিশ (টেক্সট বা ইমেজ)
 *  - popup_offer : অফার (টেক্সট বা ইমেজ)
 * Dismissal is remembered for the browser session (per popup + content hash).
 */

type PopupSettings = {
  enabled: boolean;
  type: 'text' | 'image';
  title: string;
  message: string;
  image: string;
  buttonText: string;
  link: string;
};

const DISMISS_PREFIX = 'tsb_popup_dismissed_';

function popupFromSettings(s: Record<string, string>, prefix: 'popup_notice' | 'popup_offer'): PopupSettings {
  return {
    enabled: s[`${prefix}_enabled`] === '1',
    type: s[`${prefix}_type`] === 'image' ? 'image' : 'text',
    title: s[`${prefix}_title`] || '',
    message: s[`${prefix}_message`] || '',
    image: s[`${prefix}_image`] || '',
    buttonText: s[`${prefix}_button_text`] || '',
    link: s[`${prefix}_link`] || '',
  };
}

function hasContent(p: PopupSettings): boolean {
  return p.type === 'image' ? !!p.image : !!p.message;
}

function contentHash(p: PopupSettings): string {
  return [p.title, p.message, p.image, p.buttonText].join('|').length.toString(36);
}

function isDismissed(key: string, p: PopupSettings): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem(DISMISS_PREFIX + key) === contentHash(p);
  } catch {
    return false;
  }
}

function dismiss(key: string, p: PopupSettings) {
  try {
    sessionStorage.setItem(DISMISS_PREFIX + key, contentHash(p));
  } catch {
    // ignore
  }
}

function PopupBody({ p, onClose }: { p: PopupSettings; onClose: () => void }) {
  const navigate = useStore((s) => s.navigate);

  const go = () => {
    onClose();
    if (p.link) {
      // internal links like "/#offers" or category slugs; otherwise open in new tab
      if (p.link.startsWith('/')) {
        if (p.link === '/#offers') navigate({ name: 'shop', offers: true });
        else if (p.link === '/') navigate({ name: 'home' });
        else navigate({ name: 'shop', category: p.link.replace(/^\/+/, '') });
      } else {
        window.open(p.link, '_blank', 'noopener');
      }
    }
  };

  return (
    <div className="-mt-2">
      {p.type === 'image' && p.image ? (
        <button
          type="button"
          onClick={go}
          className="relative block aspect-[16/10] w-full overflow-hidden rounded-lg border bg-muted"
          aria-label={p.title}
        >
          {/* ইমেজ data-URL হতে পারে */}
          <Image src={p.image} alt={p.title} fill unoptimized className="object-cover" sizes="(max-width: 640px) 90vw, 420px" />
        </button>
      ) : null}
      {(p.message || p.type === 'text') && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.message}</p>
      )}
      <div className="mt-4 flex gap-2">
        <Button className="flex-1 font-semibold" onClick={go}>
          {p.buttonText || 'ঠিক আছে'}
        </Button>
        <Button variant="outline" onClick={onClose}>বন্ধ করুন</Button>
      </div>
    </div>
  );
}

export function SitePopup() {
  // অ্যাডমিন সেটিংস — রিয়েক্টিভ হুক (useSettings) থেকে পড়া হয়
  const settings = useSettings() as unknown as Record<string, string>;
  const [notice, setNotice] = useState<PopupSettings | null>(null);
  const [offer, setOffer] = useState<PopupSettings | null>(null);

  const noticeCfg = popupFromSettings(settings, 'popup_notice');
  const offerCfg = popupFromSettings(settings, 'popup_offer');
  const cfgKey = JSON.stringify([noticeCfg, offerCfg]);

  useEffect(() => {
    // সেটিংস পরিবর্তনে পপআপ দেখানো (sessionStorage অ্যাক্সেসের জন্য টাইমারে ডেফার)
    const t = setTimeout(() => {
      if (noticeCfg.enabled && hasContent(noticeCfg) && !isDismissed('notice', noticeCfg)) {
        setNotice(noticeCfg);
      } else if (offerCfg.enabled && hasContent(offerCfg) && !isDismissed('offer', offerCfg)) {
        setOffer(offerCfg);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [cfgKey]);

  const closeNotice = () => {
    if (notice) dismiss('notice', notice);
    setNotice(null);
    // Chain to the offer popup if present & not dismissed
    if (offerCfg.enabled && hasContent(offerCfg) && !isDismissed('offer', offerCfg)) {
      setOffer(offerCfg);
    }
  };

  const closeOffer = () => {
    if (offer) dismiss('offer', offer);
    setOffer(null);
  };

  return (
    <>
      <Dialog open={!!notice} onOpenChange={(open) => !open && closeNotice()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
              {notice?.title || 'নোটিশ'}
            </DialogTitle>
            <DialogDescription className="sr-only">গুরুত্বপূর্ণ নোটিশ</DialogDescription>
          </DialogHeader>
          {notice && <PopupBody p={notice} onClose={closeNotice} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!offer} onOpenChange={(open) => !open && closeOffer()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4.5 w-4.5 text-destructive" aria-hidden="true" />
              {offer?.title || 'বিশেষ অফার'}
            </DialogTitle>
            <DialogDescription className="sr-only">বিশেষ অফার</DialogDescription>
          </DialogHeader>
          {offer && <PopupBody p={offer} onClose={closeOffer} />}
        </DialogContent>
      </Dialog>

      {/* a11y: visually hidden close hint for screen readers */}
      <span className="sr-only" aria-hidden="true"><X /></span>
    </>
  );
}

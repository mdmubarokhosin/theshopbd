// Bootstrap Icons (via CDN) — shared icon registry
// Icon values are bootstrap icon classes without the "bi-" base class,
// e.g. "bi-laptop". Render with <BiIcon name="bi-laptop" /> or <i className="bi bi-laptop" />.

import { cn } from '@/lib/utils';

/** Map of legacy emoji icons → bootstrap icon names (for safety on old data). */
export const EMOJI_TO_BI: Record<string, string> = {
  '💻': 'bi-laptop',
  '📱': 'bi-phone',
  '👕': 'bi-handbag',
  '🏠': 'bi-house-heart',
  '💄': 'bi-flower1',
  '⌚': 'bi-watch',
  '🎒': 'bi-backpack',
  '⚽': 'bi-trophy',
  '🧸': 'bi-balloon',
  '📚': 'bi-journal-bookmark',
  '🛒': 'bi-basket',
  '🖨️': 'bi-printer',
  '🖨': 'bi-printer',
  '🎧': 'bi-headphones',
  '👔': 'bi-person',
  '👗': 'bi-person-standing-dress',
  '👟': 'bi-bag',
};

export const DEFAULT_CATEGORY_ICON = 'bi-basket';

/** Resolve a stored category icon (may be emoji or bootstrap name) to a bootstrap class. */
export function resolveCategoryIcon(icon?: string | null): string {
  if (!icon) return DEFAULT_CATEGORY_ICON;
  const trimmed = icon.trim();
  if (EMOJI_TO_BI[trimmed]) return EMOJI_TO_BI[trimmed];
  if (trimmed.startsWith('bi-')) return trimmed;
  return `bi-${trimmed}`;
}

/** Curated bootstrap icon list for the admin category icon picker. */
export const CATEGORY_ICON_PICKER: string[] = [
  'bi-laptop',
  'bi-phone',
  'bi-smartwatch',
  'bi-headphones',
  'bi-printer',
  'bi-handbag',
  'bi-person',
  'bi-person-standing-dress',
  'bi-bag',
  'bi-house-heart',
  'bi-flower1',
  'bi-watch',
  'bi-backpack',
  'bi-balloon',
  'bi-puzzle',
  'bi-journal-bookmark',
  'bi-basket',
  'bi-trophy',
  'bi-tags',
  'bi-gift',
  'bi-fire',
  'bi-star',
  'bi-heart',
  'bi-shop',
  'bi-tools',
  'bi-lightning-charge',
  'bi-diagram-3',
  'bi-headset',
];

/** Curated bootstrap icon list for the homepage "why us" feature picker. */
export const FEATURE_ICON_PICKER: string[] = [
  'bi-award',
  'bi-shield-check',
  'bi-truck',
  'bi-piggy-bank',
  'bi-lightning-charge',
  'bi-patch-check-fill',
  'bi-cash-coin',
  'bi-headset',
  'bi-star-fill',
  'bi-heart-fill',
  'bi-gift-fill',
  'bi-shop-window',
  'bi-people-fill',
  'bi-arrow-repeat',
  'bi-clock-fill',
  'bi-geo-alt-fill',
  'bi-telephone-fill',
  'bi-bag-check-fill',
  'bi-box-seam-fill',
  'bi-stars',
];

/** Bootstrap icon component. */
export function BiIcon({
  name,
  className,
  ...rest
}: { name: string; className?: string } & React.HTMLAttributes<HTMLElement>) {
  const cls = name.startsWith('bi-') ? `bi ${name}` : `bi bi-${name}`;
  return <i className={cn(cls, className)} aria-hidden="true" {...rest} />;
}

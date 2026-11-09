/**
 * অ্যাডমিন সেকশন রেজিস্ট্রি — সার্ভার ও ক্লায়েন্ট দু-জায়গায়ই ব্যবহৃত
 * ('use client' নয় — তাই /admin সার্ভার পেজ এখান থেকে টাইপ/লিস্ট ইমপোর্ট করতে পারে)
 */

export type Section =
  | 'dashboard' | 'products' | 'categories' | 'brands'
  | 'orders' | 'payments' | 'coupons' | 'reviews' | 'subscribers'
  | 'customers' | 'delivery' | 'marketing' | 'cms'
  | 'loyalty' | 'referral' | 'abandoned'
  | 'whatsapp' | 'analytics' | 'push' | 'sms' | 'courier' | 'gateways'
  | 'roles' | 'reports' | 'content' | 'settings' | 'system';

export const ADMIN_SECTIONS: Section[] = [
  'dashboard', 'products', 'categories', 'brands', 'orders', 'payments', 'coupons',
  'reviews', 'subscribers', 'customers', 'delivery', 'marketing', 'cms',
  'loyalty', 'referral', 'abandoned',
  'whatsapp', 'analytics', 'push', 'sms', 'courier', 'gateways',
  'roles', 'reports', 'content', 'settings', 'system',
];

/** ?section= প্যারাম ভ্যালিড কিনা */
export function isValidSection(s: string | undefined | null): s is Section {
  return !!s && (ADMIN_SECTIONS as string[]).includes(s);
}

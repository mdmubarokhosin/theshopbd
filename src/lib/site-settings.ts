/** Central registry of all admin-controlled site settings (A to Z). */

export const DEFAULT_SETTINGS: Record<string, string> = {
  // Site identity
  site_title: 'THE SHOP BD',
  site_tagline: 'মাল্টিব্র্যান্ড অনলাইন শপিং',
  site_logo: '', // empty = built-in SVG logo
  site_description:
    'THE SHOP BD — বাংলাদেশের বিশ্বস্ত মাল্টিব্র্যান্ড অনলাইন শপ। ইলেকট্রনিকস, ফ্যাশন, হোম ও লিভিং, বিউটিসহ ২১+ বিখ্যাত ব্র্যান্ডের অরিজিনাল পণ্য সারাদেশে হোম ডেলিভারি।',

  // Contact
  contact_phone: '+৮৮০৯৬৪২-৯২২৯২২',
  contact_email: 'contact@theshopbd.com',
  contact_address: 'রামপুরা, ঢাকা-১২১৯, বাংলাদেশ',

  // Social
  social_facebook: '',
  social_youtube: '',
  social_instagram: '',

  // Footer
  footer_text: 'ভালোবাসা দিয়ে তৈরি — ঢাকা, বাংলাদেশে',

  // Homepage section visibility
  section_brands: '1',
  section_why: '1',
  section_testimonials: '1',
  section_payment: '1',

  // পণ্য পেজ পার্ক বক্স (ট্রাস্ট ব্যাজ) — আইটেমগুলো productPerks কালেকশনে
  pd_perks_enabled: '1',

  // Popup notice (image সহ বা ছাড়া)
  popup_notice_enabled: '0',
  popup_notice_type: 'text', // 'text' | 'image'
  popup_notice_title: 'নোটিশ',
  popup_notice_message: '',
  popup_notice_image: '',
  popup_notice_button_text: 'ঠিক আছে',
  popup_notice_link: '',

  // Popup offer (image সহ বা ছাড়া)
  popup_offer_enabled: '0',
  popup_offer_type: 'text',
  popup_offer_title: 'বিশেষ অফার',
  popup_offer_message: '',
  popup_offer_image: '',
  popup_offer_button_text: 'অফার দেখুন',
  popup_offer_link: '',

  // WhatsApp অর্ডার বাটন
  wa_enabled: '0',
  wa_phone: '',
  wa_message_template: 'আসসালামু আলাইকুম! আমি {site}-এ অর্ডার করতে চাই।',
  wa_float_enabled: '1',
  wa_float_position: 'right',
  wa_product_button: '1',

  // অ্যানালিটিক্স
  ga4_enabled: '0',
  ga4_id: '',
  fb_pixel_enabled: '0',
  fb_pixel_id: '',

  // পুশ নোটিফিকেশন
  push_enabled: '0',
  push_vapid_key: '',

  // SMS
  sms_enabled: '0',
  sms_provider_type: 'bulksmsbd',
  sms_api_url: 'https://bulksmsbd.net/api/apiSend_sms/sendingapi',
  sms_api_key: '',
  sms_sender_id: '',
  sms_store_id: '',
  sms_store_password: '',
  sms_custom_method: 'POST',
  sms_custom_body: 'api_key={apikey}&type=text&number={to}&senderid={sender}&message={message}',
  sms_tpl_order: '',
  sms_tpl_status: '',
  sms_tpl_abandoned: '',
  sms_admin_phone: '',

  // Steadfast / গেটওয়ে / লয়ালটি / রেফারেল / অ্যাব্যান্ডন্ড
  sf_enabled: '0', sf_api_url: '', sf_api_key: '', sf_secret_key: '', sf_send_cod: '1',
  bkash_enabled: '0', bkash_mode: 'sandbox', bkash_username: '', bkash_password: '', bkash_app_key: '', bkash_app_secret: '',
  sslcz_enabled: '0', sslcz_mode: 'sandbox', sslcz_store_id: '', sslcz_store_passwd: '', sslcz_currency: 'BDT',
  webhook_secret: 'tsb-hook-change-me',
  loyalty_enabled: '0', loyalty_earn_rate: '1', loyalty_point_value: '1', loyalty_min_redeem: '50', loyalty_max_percent: '50',
  referral_enabled: '0', referral_percent: '5', referral_first_only: '1', referral_min_withdraw: '500',
  ac_enabled: '0', ac_threshold: '60', ac_offer_text: '',
};

/** Keys the public settings API exposes (all storefront-facing values). */
export const PUBLIC_KEYS = Object.keys(DEFAULT_SETTINGS);

export type PopupSettings = {
  enabled: boolean;
  type: 'text' | 'image';
  title: string;
  message: string;
  image: string;
  buttonText: string;
  link: string;
};

export type SiteSettingsMap = Record<string, string>;

export function popupFromSettings(map: SiteSettingsMap, prefix: 'popup_notice' | 'popup_offer'): PopupSettings {
  return {
    enabled: map[`${prefix}_enabled`] === '1',
    type: map[`${prefix}_type`] === 'image' ? 'image' : 'text',
    title: map[`${prefix}_title`] || '',
    message: map[`${prefix}_message`] || '',
    image: map[`${prefix}_image`] || '',
    buttonText: map[`${prefix}_button_text`] || 'ঠিক আছে',
    link: map[`${prefix}_link`] || '',
  };
}

'use client';

/**
 * অ্যাডমিন — ইন্টিগ্রেশন সেকশনসমূহ
 * ---------------------------------------------------------------------------
 * • AdminWhatsApp   — WhatsApp অর্ডার বাটন ও ফ্লোটিং চ্যাট (সম্পূর্ণ কন্ট্রোল)
 * • AdminAnalytics  — GA4 + Facebook Pixel
 * • AdminPush       — PWA পুশ নোটিফিকেশন (VAPID)
 * • AdminSms        — SMS প্রোভাইডার (Bulk SMS BD / SSL Wireless / কাস্টম) + টেমপ্লেট + লগ
 * • AdminCourier    — Steadfast কুরিয়ার API
 * • AdminGateways   — bKash / SSLCommerz + কাস্টম পেমেন্ট গেটওয়ে CRUD
 */

import { useMemo, useState } from 'react';
import {
  Save, MessageCircle, BarChart3, BellRing, Smartphone, Wallet, Loader2,
  Plus, Trash2, TestTube2, Send, Radio, CreditCard, Landmark, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSettings, useCollection } from '@/lib/db/hooks';
import { saveSettings } from '@/lib/db/services';
import { db, uid } from '@/lib/db/core';
import { sendSms, steadfastBalance } from '@/lib/db/growth';
import { formatBDT, toBn, formatBnDate } from '@/lib/types';
import { ImageUploadField } from './admin-ui';
import { cn } from '@/lib/utils';
import type { CustomGateway, SiteSettings } from '@/lib/db/types';

type SKey = keyof SiteSettings;

/** সাধারণ সেটিংস-ট্যাব ফ্রেম (লোড → এডিট → সেভ) */
function useSettingsForm(keys: SKey[]) {
  const settings = useSettings();
  const initial = useMemo(() => {
    const o: Record<string, string> = {};
    for (const k of keys) o[k] = (settings as unknown as Record<string, string>)[k] ?? '';
    return o;
     
  }, []);
  const [f, setF] = useState<Record<string, string>>(initial);
  const set = (k: SKey) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  return { f, set, settings };
}

// ═══════════════════════ WhatsApp ═══════════════════════

export function AdminWhatsApp() {
  const { toast } = useToast();
  const { f, set } = useSettingsForm([
    'wa_enabled', 'wa_phone', 'wa_message_template', 'wa_float_enabled', 'wa_float_position', 'wa_product_button',
  ]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(f as Partial<SiteSettings>);
      toast({ title: 'WhatsApp সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><MessageCircle className="h-5 w-5 text-[#25D366]" /> WhatsApp অর্ডার ও চ্যাট</h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">WhatsApp ফিচার চালু</p>
              <p className="text-xs text-muted-foreground">মাস্টার সুইচ — বন্ধ করলে সব বাটন লুকাবে</p>
            </div>
            <Switch checked={f.wa_enabled === '1'} onCheckedChange={(v) => set('wa_enabled')(v ? '1' : '0')} />
          </div>
          <div className="sm:max-w-xs">
            <Label>WhatsApp নম্বর (8801XXXXXXXXX)</Label>
            <Input className="mt-1.5" value={f.wa_phone} onChange={(e) => set('wa_phone')(e.target.value.replace(/\D/g, ''))} placeholder="8801712345678" />
          </div>
          <div>
            <Label>মেসেজ টেমপ্লেট (ফ্লোটিং বাটন)</Label>
            <Textarea className="mt-1.5" rows={2} value={f.wa_message_template} onChange={(e) => set('wa_message_template')(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">ভেরিয়েবল: {'{site}'} {'{product}'} {'{price}'} {'{qty}'} {'{url}'}</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">ফ্লোটিং চ্যাট বাটন</p>
              <p className="text-xs text-muted-foreground">সব পেজের কোণায় সবুজ WhatsApp বাটন</p>
            </div>
            <Switch checked={f.wa_float_enabled === '1'} onCheckedChange={(v) => set('wa_float_enabled')(v ? '1' : '0')} />
          </div>
          <div className="sm:max-w-xs">
            <Label>ফ্লোটিং বাটনের অবস্থান</Label>
            <Select value={f.wa_float_position || 'right'} onValueChange={set('wa_float_position')}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="right">ডানে</SelectItem>
                <SelectItem value="left">বামে</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">পণ্য পেজে &quot;WhatsApp-এ অর্ডার&quot; বাটন</p>
              <p className="text-xs text-muted-foreground">পণ্যের নাম-দাম-লিংকসহ মেসেজ প্রি-ফিল হয়</p>
            </div>
            <Switch checked={f.wa_product_button === '1'} onCheckedChange={(v) => set('wa_product_button')(v ? '1' : '0')} />
          </div>
        </div>
        <Button className="mt-4 gap-1.5" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
        </Button>
      </div>
      <div className="rounded-xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        টিপ: নম্বরটি <strong>কান্ট্রি কোডসহ</strong> দিন (0 বাদে) — যেমন 01712345678 নয়, 8801712345678।
        কাস্টমার বাটনে চাপলেই সরাসরি আপনার WhatsApp-এ চ্যাট খুলবে।
      </div>
    </div>
  );
}

// ═══════════════════════ অ্যানালিটিক্স ═══════════════════════

export function AdminAnalytics() {
  const { toast } = useToast();
  const { f, set, settings } = useSettingsForm(['ga4_enabled', 'ga4_id', 'fb_pixel_enabled', 'fb_pixel_id']);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(f as Partial<SiteSettings>);
      toast({ title: 'অ্যানালিটিক্স সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><BarChart3 className="h-5 w-5 text-primary" /> Google Analytics 4</h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">GA4 চালু</p>
              <p className="text-xs text-muted-foreground">পেজভিউ + ই-কমার্স ইভেন্ট (view_item, add_to_cart, purchase...)</p>
            </div>
            <Switch checked={f.ga4_enabled === '1'} onCheckedChange={(v) => set('ga4_enabled')(v ? '1' : '0')} />
          </div>
          <div className="sm:max-w-md">
            <Label>Measurement ID (G-XXXXXXX)</Label>
            <Input className="mt-1.5" value={f.ga4_id} onChange={(e) => set('ga4_id')(e.target.value.trim())} placeholder="G-XXXXXXXXXX" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              খালি রাখলে Firebase অটো-রিপোর্টিং আইডি ব্যবহার হবে: <code className="rounded bg-muted px-1">{settings ? '' : ''}Firebase measurementId</code>
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Radio className="h-5 w-5 text-primary" /> Facebook Pixel</h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">পিক্সেল চালু</p>
              <p className="text-xs text-muted-foreground">ViewContent, AddToCart, InitiateCheckout, Purchase</p>
            </div>
            <Switch checked={f.fb_pixel_enabled === '1'} onCheckedChange={(v) => set('fb_pixel_enabled')(v ? '1' : '0')} />
          </div>
          <div className="sm:max-w-md">
            <Label>Pixel ID (সংখ্যা)</Label>
            <Input className="mt-1.5" value={f.fb_pixel_id} onChange={(e) => set('fb_pixel_id')(e.target.value.replace(/\D/g, ''))} placeholder="123456789012345" />
          </div>
        </div>
      </div>

      <Button className="gap-1.5" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
      </Button>
    </div>
  );
}

// ═══════════════════════ পুশ নোটিফিকেশন ═══════════════════════

export function AdminPush() {
  const { toast } = useToast();
  const { f, set } = useSettingsForm(['push_enabled', 'push_vapid_key']);
  const [saving, setSaving] = useState(false);
  const tokens = useCollection('pushTokens');

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(f as Partial<SiteSettings>);
      toast({ title: 'পুশ সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  const testNotify = async () => {
    if (!('Notification' in window)) return toast({ title: 'এই ব্রাউজারে Notification নেই', variant: 'destructive' });
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('THE SHOP BD', { body: 'পুশ নোটিফিকেশন কাজ করছে! ✅', icon: '/icons/icon-192.png' });
    } else {
      toast({ title: 'পারমিশন দেওয়া হয়নি', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><BellRing className="h-5 w-5 text-primary" /> পুশ নোটিফিকেশন (FCM)</h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">পুশ চালু</p>
              <p className="text-xs text-muted-foreground">কাস্টমার পারমিশন দিলে অফার/আপডেট নোটিফিকেশন পাবে</p>
            </div>
            <Switch checked={f.push_enabled === '1'} onCheckedChange={(v) => set('push_enabled')(v ? '1' : '0')} />
          </div>
          <div>
            <Label>VAPID Public Key</Label>
            <Textarea className="mt-1.5 font-mono text-xs" rows={3} value={f.push_vapid_key} onChange={(e) => set('push_vapid_key')(e.target.value.trim())} placeholder="BB..." />
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Firebase Console → প্রজেক্ট সেটিংস → Cloud Messaging → Web Push certificates → Generate key pair —
              সেই public key এখানে দিন। এরপর কাস্টমাররা সাইটে ঢুকলেই নোটিফিকেশন পারমিশন চাইবে।
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5" onClick={testNotify}>
              <Smartphone className="h-4 w-4" /> টেস্ট নোটিফিকেশন
            </Button>
          </div>
        </div>
        <Button className="mt-4 gap-1.5" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <h2 className="flex items-center gap-2 border-b p-4 font-bold"><Smartphone className="h-5 w-5 text-primary" /> রেজিস্টার্ড ডিভাইস ({toBn(tokens.length)})</h2>
        <div className="max-h-64 divide-y overflow-y-auto scrollbar-thin">
          {tokens.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">এখনো কোনো ডিভাইস সাবস্ক্রাইব করেনি</p>}
          {tokens.slice(0, 50).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-3">
              <p className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{t.token.slice(0, 44)}…</p>
              <span className="shrink-0 text-[10px] text-muted-foreground">{formatBnDate(t.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ SMS ═══════════════════════

export function AdminSms() {
  const { toast } = useToast();
  const { f, set } = useSettingsForm([
    'sms_enabled', 'sms_provider_type', 'sms_api_url', 'sms_api_key', 'sms_sender_id',
    'sms_store_id', 'sms_store_password', 'sms_custom_method', 'sms_custom_body',
    'sms_tpl_order', 'sms_tpl_status', 'sms_tpl_abandoned', 'sms_admin_phone',
  ]);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const logs = useCollection('smsLogs');

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(f as Partial<SiteSettings>);
      toast({ title: 'SMS সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    const res = await sendSms({
      to: testTo.trim(),
      message: 'THE SHOP BD টেস্ট SMS — কনফিগারেশন সফল! ✅',
      template: 'test',
    });
    setTesting(false);
    if (res.ok) toast({ title: 'টেস্ট SMS পাঠানো হয়েছে!' });
    else toast({ title: 'ব্যর্থ', description: res.error, variant: 'destructive' });
  };

  const provider = f.sms_provider_type || 'bulksmsbd';

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Send className="h-5 w-5 text-primary" /> SMS গেটওয়ে কনফিগারেশন</h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">SMS চালু</p>
              <p className="text-xs text-muted-foreground">অর্ডার কনফার্ম, স্ট্যাটাস আপডেট ও রিমাইন্ডার SMS</p>
            </div>
            <Switch checked={f.sms_enabled === '1'} onCheckedChange={(v) => set('sms_enabled')(v ? '1' : '0')} />
          </div>
          <div className="sm:max-w-xs">
            <Label>প্রোভাইডার</Label>
            <Select value={provider} onValueChange={set('sms_provider_type')}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bulksmsbd">Bulk SMS BD (bulksmsbd.net)</SelectItem>
                <SelectItem value="sslwireless">SSL Wireless</SelectItem>
                <SelectItem value="custom">কাস্টম API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:max-w-md">
            <Label>API URL</Label>
            <Input className="mt-1.5" value={f.sms_api_url} onChange={(e) => set('sms_api_url')(e.target.value)} />
          </div>
          {provider === 'bulksmsbd' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:max-w-xs">
                <Label>API Key</Label>
                <Input className="mt-1.5" type="password" value={f.sms_api_key} onChange={(e) => set('sms_api_key')(e.target.value)} />
              </div>
              <div className="sm:max-w-xs">
                <Label>Sender ID</Label>
                <Input className="mt-1.5" value={f.sms_sender_id} onChange={(e) => set('sms_sender_id')(e.target.value)} />
              </div>
            </div>
          )}
          {provider === 'sslwireless' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:max-w-xs">
                <Label>Store ID (SID)</Label>
                <Input className="mt-1.5" value={f.sms_store_id} onChange={(e) => set('sms_store_id')(e.target.value)} />
              </div>
              <div className="sm:max-w-xs">
                <Label>Store Password (API Token)</Label>
                <Input className="mt-1.5" type="password" value={f.sms_store_password} onChange={(e) => set('sms_store_password')(e.target.value)} />
              </div>
            </div>
          )}
          {provider === 'custom' && (
            <>
              <div className="sm:max-w-xs">
                <Label>Method</Label>
                <Select value={f.sms_custom_method || 'POST'} onValueChange={set('sms_custom_method')}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Body টেমপ্লেট</Label>
                <Textarea className="mt-1.5 font-mono text-xs" rows={2} value={f.sms_custom_body} onChange={(e) => set('sms_custom_body')(e.target.value)} />
                <p className="mt-1 text-[11px] text-muted-foreground">ভেরিয়েবল: {'{apikey}'} {'{to}'} {'{message}'} {'{sender}'} {'{storeid}'} {'{storepass}'}</p>
              </div>
            </>
          )}

          <Separator2 />

          <h3 className="text-sm font-bold">SMS টেমপ্লেট</h3>
          <div>
            <Label>নতুন অর্ডার (কাস্টমার)</Label>
            <Textarea className="mt-1.5" rows={2} value={f.sms_tpl_order} onChange={(e) => set('sms_tpl_order')(e.target.value)} />
          </div>
          <div>
            <Label>স্ট্যাটাস আপডেট</Label>
            <Textarea className="mt-1.5" rows={2} value={f.sms_tpl_status} onChange={(e) => set('sms_tpl_status')(e.target.value)} />
          </div>
          <div>
            <Label>অ্যাব্যান্ডন্ড কার্ট রিমাইন্ডার</Label>
            <Textarea className="mt-1.5" rows={2} value={f.sms_tpl_abandoned} onChange={(e) => set('sms_tpl_abandoned')(e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">ভেরিয়েবল: {'{name}'} {'{order}'} {'{total}'} {'{status}'} {'{site}'} {'{count}'} {'{offer}'}</p>
          <div className="sm:max-w-xs">
            <Label>অ্যাডমিন নোটিফিকেশন নম্বর (নতুন অর্ডারে)</Label>
            <Input className="mt-1.5" value={f.sms_admin_phone} onChange={(e) => set('sms_admin_phone')(e.target.value.replace(/[^\d+]/g, ''))} placeholder="8801XXXXXXXXX" />
          </div>
        </div>
        <Button className="mt-4 gap-1.5" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
        </Button>
      </div>

      {/* টেস্ট */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><TestTube2 className="h-5 w-5 text-primary" /> টেস্ট SMS</h2>
        <div className="flex gap-2 sm:max-w-md">
          <Input value={testTo} onChange={(e) => setTestTo(e.target.value.replace(/\D/g, ''))} placeholder="01XXXXXXXXX" />
          <Button onClick={sendTest} disabled={testing || !testTo} className="gap-1.5 shrink-0">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} পাঠান
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">প্রথমে সেভ করে তারপর টেস্ট করুন</p>
      </div>

      {/* লগ */}
      <div className="rounded-xl border bg-card">
        <h2 className="flex items-center gap-2 border-b p-4 font-bold"><ListChecks className="h-5 w-5 text-primary" /> SMS লগ (সর্বশেষ {toBn(logs.length)})</h2>
        <div className="max-h-80 divide-y overflow-y-auto scrollbar-thin">
          {logs.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">এখনো কোনো SMS পাঠানো হয়নি</p>}
          {logs.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{l.to} {l.orderNumber && <span className="font-normal text-muted-foreground">· {l.orderNumber}</span>}</p>
                <p className="truncate text-xs text-muted-foreground">{l.message}</p>
                {l.error && <p className="text-[11px] text-destructive">{l.error}</p>}
              </div>
              <div className="shrink-0 text-right">
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold',
                  l.status === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : l.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {l.status === 'sent' ? 'পাঠানো' : l.status === 'failed' ? 'ব্যর্থ' : 'বাদ'}
                </span>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{formatBnDate(l.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Separator2() {
  return <div className="border-t" />;
}

// ═══════════════════════ কুরিয়ার (Steadfast) ═══════════════════════

export function AdminCourier() {
  const { toast } = useToast();
  const { f, set } = useSettingsForm(['sf_enabled', 'sf_api_url', 'sf_api_key', 'sf_secret_key', 'sf_send_cod']);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balBusy, setBalBusy] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(f as Partial<SiteSettings>);
      toast({ title: 'কুরিয়ার সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  const checkBalance = async () => {
    setBalBusy(true);
    const res = await steadfastBalance();
    setBalBusy(false);
    if (res.ok) setBalance(res.balance ?? null);
    else toast({ title: 'ব্যালেন্স আনা যায়নি', description: res.error, variant: 'destructive' });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Landmark className="h-5 w-5 text-primary" /> Steadfast কুরিয়ার API</h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">Steadfast ইন্টিগ্রেশন চালু</p>
              <p className="text-xs text-muted-foreground">অর্ডার পেজ থেকে এক ক্লিকে কনসাইনমেন্ট তৈরি হবে</p>
            </div>
            <Switch checked={f.sf_enabled === '1'} onCheckedChange={(v) => set('sf_enabled')(v ? '1' : '0')} />
          </div>
          <div className="sm:max-w-md">
            <Label>API URL</Label>
            <Input className="mt-1.5" value={f.sf_api_url} onChange={(e) => set('sf_api_url')(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">ডিফল্ট: https://portal.steadfast.com.bd/api/v1</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>API Key</Label>
              <Input className="mt-1.5" type="password" value={f.sf_api_key} onChange={(e) => set('sf_api_key')(e.target.value)} />
            </div>
            <div>
              <Label>Secret Key</Label>
              <Input className="mt-1.5" type="password" value={f.sf_secret_key} onChange={(e) => set('sf_secret_key')(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">অপরিশোধিত অর্ডারে COD amount পাঠাও</p>
              <p className="text-xs text-muted-foreground">পরিশোধিত অর্ডারে ০ যাবে</p>
            </div>
            <Switch checked={f.sf_send_cod === '1'} onCheckedChange={(v) => set('sf_send_cod')(v ? '1' : '0')} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button className="gap-1.5" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={checkBalance} disabled={balBusy}>
            {balBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} ব্যালেন্স দেখুন
          </Button>
          {balance !== null && (
            <span className="text-sm font-bold text-primary">স্টিডফাস্ট ব্যালেন্স: {formatBDT(balance)}</span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        <strong>কীভাবে কাজ করে:</strong> অ্যাডমিন → অর্ডার ও রিটার্ন → যেকোনো অর্ডার খুলে
        &quot;Steadfast-এ পাঠান&quot; বাটনে চাপুন — কনসাইনমেন্ট তৈরি হয়ে ট্র্যাকিং নম্বর অর্ডারে সেভ হয়ে যাবে।
        API কী/সিক্রেট Steadfast মার্চেন্ট প্যানেল (portal.steadfast.com.bd) → Settings → API থেকে নিন।
      </div>
    </div>
  );
}

// ═══════════════════════ পেমেন্ট গেটওয়ে ═══════════════════════

export function AdminGateways() {
  const { toast } = useToast();
  const { f, set } = useSettingsForm([
    'bkash_enabled', 'bkash_mode', 'bkash_username', 'bkash_password', 'bkash_app_key', 'bkash_app_secret',
    'sslcz_enabled', 'sslcz_mode', 'sslcz_store_id', 'sslcz_store_passwd',
  ]);
  const [saving, setSaving] = useState(false);
  const gateways = useCollection('customGateways');
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CustomGateway | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(f as Partial<SiteSettings>);
      toast({ title: 'গেটওয়ে সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  const newGateway = () => {
    setEditing({ id: uid('cg'), name: '', logo: null, accountNumber: null, instructions: null, needsTrxId: true, active: true, sortOrder: gateways.length + 1 });
    setEditOpen(true);
  };
  const editGateway = (g: CustomGateway) => {
    setEditing({ ...g });
    setEditOpen(true);
  };
  const saveGateway = () => {
    if (!editing || !editing.name.trim()) return toast({ title: 'গেটওয়ের নাম দিন', variant: 'destructive' });
    db.put('customGateways', editing);
    setEditOpen(false);
    toast({ title: 'কাস্টম গেটওয়ে সেভ হয়েছে' });
  };
  const removeGateway = (id: string) => {
    db.remove('customGateways', id);
    toast({ title: 'মুছে ফেলা হয়েছে' });
  };

  return (
    <div className="space-y-5">
      {/* bKash */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Wallet className="h-5 w-5 text-[#E2136E]" /> bKash Tokenized Checkout</h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">bKash গেটওয়ে চালু</p>
              <p className="text-xs text-muted-foreground">কাস্টমার সরাসরি bKash পেজে গিয়ে পেমেন্ট করবে (অটো ভেরিফাই)</p>
            </div>
            <Switch checked={f.bkash_enabled === '1'} onCheckedChange={(v) => set('bkash_enabled')(v ? '1' : '0')} />
          </div>
          <div className="sm:max-w-xs">
            <Label>মোড</Label>
            <Select value={f.bkash_mode || 'sandbox'} onValueChange={set('bkash_mode')}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (টেস্ট)</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Username</Label>
              <Input className="mt-1.5" value={f.bkash_username} onChange={(e) => set('bkash_username')(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input className="mt-1.5" type="password" value={f.bkash_password} onChange={(e) => set('bkash_password')(e.target.value)} />
            </div>
            <div>
              <Label>App Key</Label>
              <Input className="mt-1.5" value={f.bkash_app_key} onChange={(e) => set('bkash_app_key')(e.target.value)} />
            </div>
            <div>
              <Label>App Secret</Label>
              <Input className="mt-1.5" type="password" value={f.bkash_app_secret} onChange={(e) => set('bkash_app_secret')(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* SSLCommerz */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><CreditCard className="h-5 w-5 text-primary" /> SSLCommerz (কার্ড + সব ব্যাংক)</h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-semibold">SSLCommerz চালু</p>
              <p className="text-xs text-muted-foreground">Visa/Mastercard, নেট ব্যাংকিং, মোবাইল ব্যাংকিং — একসাথে</p>
            </div>
            <Switch checked={f.sslcz_enabled === '1'} onCheckedChange={(v) => set('sslcz_enabled')(v ? '1' : '0')} />
          </div>
          <div className="sm:max-w-xs">
            <Label>মোড</Label>
            <Select value={f.sslcz_mode || 'sandbox'} onValueChange={set('sslcz_mode')}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (টেস্ট)</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Store ID</Label>
              <Input className="mt-1.5" value={f.sslcz_store_id} onChange={(e) => set('sslcz_store_id')(e.target.value)} />
            </div>
            <div>
              <Label>Store Password</Label>
              <Input className="mt-1.5" type="password" value={f.sslcz_store_passwd} onChange={(e) => set('sslcz_store_passwd')(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <Button className="gap-1.5" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
      </Button>

      {/* কাস্টম গেটওয়ে */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-bold">কাস্টম পেমেন্ট গেটওয়ে ({toBn(gateways.length)})</h2>
          <Button size="sm" className="gap-1.5" onClick={newGateway}><Plus className="h-4 w-4" /> নতুন গেটওয়ে</Button>
        </div>
        <div className="divide-y">
          {gateways.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              কোনো কাস্টম গেটওয়ে নেই — যেকোনো লোকাল পেমেন্ট (নগদ/রকেট/উপায়/ব্যাংক) নিজের মতো যোগ করুন
            </p>
          )}
          {gateways.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                {g.logo ? <img src={g.logo} alt={g.name} className="h-9 w-14 shrink-0 rounded border object-contain" /> : <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {g.accountNumber || '—'} · {g.needsTrxId ? 'TrxID লাগবে' : 'TrxID লাগবে না'} · {g.active ? 'চালু' : 'বন্ধ'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="outline" onClick={() => editGateway(g)}>এডিট</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeGateway(g.id)} aria-label="মুছুন">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* এডিট ডায়ালগ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.name ? 'গেটওয়ে এডিট' : 'নতুন কাস্টম গেটওয়ে'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3.5">
              <div>
                <Label>নাম *</Label>
                <Input className="mt-1.5" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="যেমন: নগদ পার্সোনাল" />
              </div>
              <div>
                <Label>অ্যাকাউন্ট নম্বর</Label>
                <Input className="mt-1.5" value={editing.accountNumber || ''} onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })} placeholder="01XXXXXXXXX" />
              </div>
              <div>
                <Label>নির্দেশনা (কাস্টমার দেখবে)</Label>
                <Textarea className="mt-1.5" rows={2} value={editing.instructions || ''} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} placeholder="যেমন: *২৪৭# ডায়াল করে পেমেন্ট করুন" />
              </div>
              <ImageUploadField
                label="লোগো (ঐচ্ছিক)"
                value={editing.logo || ''}
                onChange={(url) => setEditing({ ...editing, logo: url || null })}
                folder="payments"
              />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Transaction ID নেবে?</p>
                  <p className="text-[11px] text-muted-foreground">চালু থাকলে চেকআউটে TrxID ফিল্ড দেখাবে</p>
                </div>
                <Switch checked={editing.needsTrxId} onCheckedChange={(v) => setEditing({ ...editing, needsTrxId: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">চালু</p>
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>বাতিল</Button>
            <Button onClick={saveGateway}>সেভ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        💡 <strong>সেটআপ নোট:</strong> bKash মার্চেন্ট অ্যাকাউন্ট (tokenized) খুলে username/password/app key নিন;
        SSLCommerz অ্যাকাউন্টে store ID/password পাবেন। সব ক্রেডেনশিয়াল সার্ভার-সাইডেই ব্যবহার হয় —
        ব্রাউজারে যায় না। কনফিগ না করা পর্যন্ত গেটওয়ে চেকআউটে দেখাবেই না।
      </div>
    </div>
  );
}

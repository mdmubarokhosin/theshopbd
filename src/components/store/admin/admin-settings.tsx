'use client';

/**
 * অ্যাডমিন — ওয়েবসাইট সেটিংস (A to Z)
 * ---------------------------------------------------------------------------
 * ট্যাব: সাধারণ / লোকালাইজেশন / ট্যাক্স ও প্রাইসিং / নোটিফিকেশন / SEO / নিরাপত্তা
 * ডেটা: useSettings() হুক (রিয়েক্টিভ) → প্রতি ট্যাবে আলাদা সেভ → saveSettings()
 * (saveSettings নিজেই অডিট লগ লিখে)
 */

import { useState } from 'react';
import {
  Save, Building, Globe2, Percent, BellRing, Search, ShieldCheck, Loader2,
  Facebook, Youtube, Instagram, Phone, ReceiptText, MessageCircle,
  Github, CloudCog, CheckCircle2, XCircle, RefreshCw, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/lib/db/hooks';
import { saveSettings } from '@/lib/db/services';
import { useCloudState } from '@/lib/db/cloud';
import {
  testGithubConnection, getGithubConfig, isGithubConfigured,
  type GithubConfig, type GithubTestResult,
} from '@/lib/db/github';
import { firebaseConfig } from '@/lib/firebase/app';
import type { SiteSettings } from '@/lib/db/types';
import { ImageUploadField } from './admin-ui';

// ───────────────────────────── কনস্ট্যান্ট ─────────────────────────────

const TIMEZONES = [
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Singapore',
  'Europe/London',
  'UTC',
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'দিন/মাস/বছর (২৫/১২/২০২৫)' },
  { value: 'YYYY-MM-DD', label: 'বছর-মাস-দিন (২০২৫-১২-২৫)' },
  { value: 'D MMMM YYYY', label: '২৫ ডিসেম্বর ২০২৫' },
];

// প্রতি ট্যাবের কী-গুলো (সেভ করলে শুধু এগুলোই পাঠানো হয়)
const GENERAL_KEYS = [
  'site_title', 'site_tagline', 'site_logo', 'site_favicon', 'site_description',
  'contact_phone', 'contact_email', 'contact_address', 'support_hours',
  'social_facebook', 'social_youtube', 'social_instagram', 'social_whatsapp', 'social_messenger',
  'footer_text', 'footer_about', 'footer_cod_text', 'invoice_note',
] as const;

const LOCAL_KEYS = ['default_language', 'currency_code', 'currency_symbol', 'timezone', 'date_format'] as const;

const TAX_KEYS = ['tax_enabled', 'tax_percent', 'tax_inclusive', 'min_order_amount', 'free_shipping_threshold'] as const;

const NOTIF_KEYS = [
  'notif_order_enabled', 'notif_promo_enabled', 'notif_stock_enabled',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_sender_email',
] as const;

const SEO_KEYS = ['seo_title', 'seo_description', 'seo_keywords', 'seo_og_image', 'seo_google_verification', 'seo_analytics_id'] as const;

const SECURITY_KEYS = ['security_session_timeout', 'security_max_login_attempts', 'security_maintenance_mode', 'security_maintenance_message'] as const;

const GITHUB_KEYS = ['github_owner', 'github_repo', 'github_branch', 'github_folder', 'github_token'] as const;

type SKey = keyof SiteSettings;

// ───────────────────────────── GitHub হোস্টিং ট্যাব ─────────────────────────────

function GithubHostingTab({
  set, get, saveTab,
}: {
  set: (k: SKey) => (v: string) => void;
  get: (k: SKey) => string;
  saveTab: (label: string, keys: readonly SKey[]) => void;
}) {
  const { toast } = useToast();
  const cloud = useCloudState();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<GithubTestResult | null>(null);

  const runTest = async (cfg?: GithubConfig) => {
    setTesting(true);
    setResult(null);
    const res = await testGithubConnection(cfg ?? {
      owner: get('github_owner').trim(),
      repo: get('github_repo').trim(),
      branch: get('github_branch').trim() || 'main',
      folder: get('github_folder').trim() || 'uploads',
      token: get('github_token').trim(),
    });
    setResult(res);
    setTesting(false);
    if (res.ok) toast({ title: 'GitHub সংযোগ সফল ✓', description: res.message });
    else toast({ title: 'সংযোগে সমস্যা', description: res.message, variant: 'destructive' });
  };

  const cloudBadge = {
    online: { icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', label: 'সংযুক্ত — Realtime Database কাজ করছে' },
    connecting: { icon: CloudCog, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40', label: 'সংযোগ হচ্ছে...' },
    offline: { icon: CloudCog, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40', label: 'অফলাইন — পরিবর্তনগুলো কিউতে আছে' },
    error: { icon: XCircle, cls: 'text-destructive bg-destructive/10', label: 'সমস্যা শনাক্ত হয়েছে' },
  }[cloud.status];

  return (
    <div className="space-y-4">
      {/* Firebase স্ট্যাটাস কার্ড */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CloudCog className="h-4 w-4" />
          </span>
          Firebase Realtime Database — স্ট্যাটাস
        </h3>
        <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${cloudBadge.cls}`}>
          <cloudBadge.icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <div>{cloudBadge.label}</div>
            {cloud.error && <div className="mt-0.5 text-xs font-normal opacity-80">{cloud.error}</div>}
            {cloud.lastSyncAt && cloud.status === 'online' && (
              <div className="mt-0.5 text-xs font-normal opacity-70">
                সর্বশেষ সিঙ্ক: {new Date(cloud.lastSyncAt).toLocaleTimeString('bn-BD')}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="rounded-lg border border-dashed p-2.5">
            <span className="font-semibold text-foreground">প্রজেক্ট:</span> {firebaseConfig.projectId}
          </div>
          <div className="rounded-lg border border-dashed p-2.5">
            <span className="font-semibold text-foreground">ডেটাবেজ:</span> Realtime Database (Firestore ব্যবহার হয় না)
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          সব সাইট-ডেটা (পণ্য, অর্ডার, সেটিংস, ইউজার) এই ডেটাবেজ থেকে লোড হয় — কোনো তথ্য কোডে হার্ডকোড করা নেই।
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Github className="h-4 w-4" />
          </span>
          GitHub রিপো হোস্টিং — কনফিগারেশন
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          ছবি/ভিডিও আপলোড হবে GitHub রিপোতে (Contents API) এবং সাইটে লোড হবে jsDelivr CDN দিয়ে।
          রিপোটি অবশ্যই <strong>Public</strong> রাখতে হবে।
        </p>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="GitHub Owner (ইউজারনেম/অর্গ)" >
              <Input value={get('github_owner')} onChange={(e) => set('github_owner')(e.target.value)} placeholder="যেমন: my-shop-bd" autoComplete="off" />
            </Field>
            <Field label="Repository নাম">
              <Input value={get('github_repo')} onChange={(e) => set('github_repo')(e.target.value)} placeholder="যেমন: theshopbd-media" autoComplete="off" />
            </Field>
            <Field label="Branch" hint="ডিফল্ট: main">
              <Input value={get('github_branch')} onChange={(e) => set('github_branch')(e.target.value)} placeholder="main" autoComplete="off" />
            </Field>
            <Field label="আপলোড ফোল্ডার" hint="রিপোর ভেতরের ফোল্ডার — ডিফল্ট: uploads">
              <Input value={get('github_folder')} onChange={(e) => set('github_folder')(e.target.value)} placeholder="uploads" autoComplete="off" />
            </Field>
          </div>
          <Field
            label="Personal Access Token (PAT)"
            hint="Fine-grained PAT তৈরি করুন → শুধু এই রিপো সিলেক্ট করুন → Permissions: Contents = Read & Write। টোকেন নিরাপদে Firebase RTDB-তে সংরক্ষিত হয়।"
          >
            <Input type="password" value={get('github_token')} onChange={(e) => set('github_token')(e.target.value)} placeholder="github_pat_..." autoComplete="off" />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveTab('GitHub কনফিগ', GITHUB_KEYS)} className="gap-1.5 font-semibold">
              <Save className="h-4 w-4" /> সেভ করুন
            </Button>
            <Button variant="outline" onClick={() => void runTest()} disabled={testing} className="gap-1.5">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              সংযোগ পরীক্ষা
            </Button>
            {isGithubConfigured() && (
              <Button variant="ghost" onClick={() => void runTest(getGithubConfig())} disabled={testing} className="gap-1.5">
                <ExternalLink className="h-4 w-4" /> সেভকৃাত কনফিগ পরীক্ষা
              </Button>
            )}
          </div>

          {result && (
            <div className={`rounded-lg border p-3 text-sm ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
              <div className="font-semibold">{result.message}</div>
              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
                <span>{result.repoOk ? '✓' : '✗'} রিপো</span>
                <span>{result.branchOk ? '✓' : '✗'} ব্রাঞ্চ</span>
                <span>{result.jsDelivrOk ? '✓' : '✗'} jsDelivr CDN</span>
              </div>
              {result.cdnBase && (
                <div className="mt-2 break-all rounded bg-background/60 px-2 py-1 font-mono text-[10px]">{result.cdnBase}/...</div>
              )}
            </div>
          )}

          <div className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">কীভাবে সেটআপ করবেন:</p>
            <p className="mt-1">১. GitHub-এ একটি <strong>Public</strong> রিপোজিটরি তৈরি করুন (যেমন: theshopbd-media)</p>
            <p>২. Settings → Developer settings → Fine-grained tokens → Generate new token</p>
            <p>৩. Repository access: Only select repositories → আপনার মিডিয়া রিপো সিলেক্ট করুন</p>
            <p>৪. Permissions → Contents → <strong>Read and write</strong> দিন</p>
            <p>৫. টোকেন কপি করে উপরের ফর্মে বসিয়ে Save → সংযোগ পরীক্ষা চালান</p>
            <p className="mt-1">এরপর থেকে পণ্য/ব্যানার/লোগোর সব ছবি এই রিপোতে জমা হবে এবং jsDelivr CDN থেকে লোড হবে।</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── ছোট পিস ─────────────────────────────

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h3>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  title, desc, checked, onChange,
}: { title: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={`${title} টগল`} />
    </label>
  );
}

// ───────────────────────────── মূল কম্পোনেন্ট ─────────────────────────────

export function AdminSettings() {
  const { toast } = useToast();
  const settings = useSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  // ইউজার কোনো ফিল্ড এডিট করলে dirty হয় — dirty না হলে RTDB/ক্রস-ট্যাব থেকে
  // আসা নতুন settings-এ ফর্ম রি-সিঙ্ক হয় (নাহলে স্টেল ফর্ম সেভ করে অন্যের কনফিগ মুছে যায়)
  const [dirty, setDirty] = useState(false);

  const [syncedSettings, setSyncedSettings] = useState(settings);
  if (syncedSettings !== settings) {
    setSyncedSettings(settings);
    if (!dirty) setForm(settings);
  }

  const set = (k: SKey) => (v: string) => {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const get = (k: SKey) => form[k] ?? '';
  const isOn = (k: SKey) => form[k] === '1';

  const saveTab = (label: string, keys: readonly SKey[]) => {
    setSaving(true);
    const patch: Partial<SiteSettings> = {};
    for (const k of keys) patch[k] = form[k];
    saveSettings(patch);
    setSaving(false);
    setDirty(false);
    toast({ title: `${label} সেভ হয়েছে`, description: 'ওয়েবসাইটে সাথে সাথে পরিবর্তন দেখা যাবে' });
  };

  const renderSaveBar = (label: string, keys: readonly SKey[]) => (
    <div className="flex justify-end">
      <Button onClick={() => saveTab(label, keys)} disabled={saving} className="gap-1.5 font-semibold">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {label} সেভ করুন
      </Button>
    </div>
  );

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h2 className="text-lg font-bold">ওয়েবসাইট সেটিংস</h2>
        <p className="text-xs text-muted-foreground">
          সাইটের পরিচিতি, কারেন্সি, ট্যাক্স, নোটিফিকেশন, SEO, নিরাপত্তা — প্রতিটি ট্যাব আলাদাভাবে সেভ হয়
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="general">সাধারণ</TabsTrigger>
          <TabsTrigger value="localization">লোকালাইজেশন</TabsTrigger>
          <TabsTrigger value="tax">ট্যাক্স ও প্রাইসিং</TabsTrigger>
          <TabsTrigger value="notification">নোটিফিকেশন</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="security">নিরাপত্তা</TabsTrigger>
          <TabsTrigger value="github">GitHub হোস্টিং</TabsTrigger>
        </TabsList>

        {/* ═══════════ সাধারণ ═══════════ */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <Card title="সাইট পরিচিতি" icon={Building}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="সাইট টাইটেল">
                <Input value={get('site_title')} onChange={(e) => set('site_title')(e.target.value)} placeholder="THE SHOP BD" />
              </Field>
              <Field label="ট্যাগলাইন">
                <Input value={get('site_tagline')} onChange={(e) => set('site_tagline')(e.target.value)} placeholder="মাল্টিব্র্যান্ড অনলাইন শপিং" />
              </Field>
            </div>
            <ImageUploadField
              label="সাইট লোগো"
              hint="খালি রাখলে বিল্ট-ইন লোগো দেখাবে। হেডার, ফুটার ও ড্রয়ারে ব্যবহৃত হবে।"
              folder="site"
              aspect="logo"
              value={get('site_logo')}
              onChange={set('site_logo')}
            />
            <ImageUploadField
              label="ফেভিকন"
              hint="ব্রাউজার ট্যাবে ছোট আইকন হিসেবে দেখাবে (৩২×৩২ PNG ভালো)"
              folder="site"
              aspect="logo"
              value={get('site_favicon')}
              onChange={set('site_favicon')}
            />
            <Field label="সাইট বর্ণনা (ফুটারে দেখাবে)">
              <Textarea value={get('site_description')} onChange={(e) => set('site_description')(e.target.value)} rows={3} />
            </Field>
          </Card>

          <Card title="যোগাযোগ" icon={Phone}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ফোন / হটলাইন">
                <Input value={get('contact_phone')} onChange={(e) => set('contact_phone')(e.target.value)} placeholder="+৮৮০৯৬৪২-৯২২৯২২" />
              </Field>
              <Field label="ইমেইল">
                <Input value={get('contact_email')} onChange={(e) => set('contact_email')(e.target.value)} placeholder="support@theshopbd.com" />
              </Field>
              <Field label="ঠিকানা">
                <Input value={get('contact_address')} onChange={(e) => set('contact_address')(e.target.value)} placeholder="রামপুরা, ঢাকা-১২১৯" />
              </Field>
              <Field label="সাপোর্ট সময়সূচি">
                <Input value={get('support_hours')} onChange={(e) => set('support_hours')(e.target.value)} placeholder="প্রতিদিন সকাল ৯টা - রাত ১০টা" />
              </Field>
            </div>
          </Card>

          <Card title="সোশ্যাল লিঙ্ক" icon={Facebook}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ফেসবুক">
                <Input value={get('social_facebook')} onChange={(e) => set('social_facebook')(e.target.value)} placeholder="https://facebook.com/..." />
              </Field>
              <Field label="ইউটিউব">
                <Input value={get('social_youtube')} onChange={(e) => set('social_youtube')(e.target.value)} placeholder="https://youtube.com/..." />
              </Field>
              <Field label="ইনস্টাগ্রাম">
                <Input value={get('social_instagram')} onChange={(e) => set('social_instagram')(e.target.value)} placeholder="https://instagram.com/..." />
              </Field>
              <Field label="হোয়াটসঅ্যাপ">
                <Input value={get('social_whatsapp')} onChange={(e) => set('social_whatsapp')(e.target.value)} placeholder="https://wa.me/8801..." />
              </Field>
              <Field label="মেসেঞ্জার">
                <Input value={get('social_messenger')} onChange={(e) => set('social_messenger')(e.target.value)} placeholder="https://m.me/..." />
              </Field>
            </div>
          </Card>

          <Card title="ফুটার ও ইনভয়েস" icon={ReceiptText}>
            <Field label="ফুটারের শেষ লাইন">
              <Input value={get('footer_text')} onChange={(e) => set('footer_text')(e.target.value)} placeholder="© ২০২৫ THE SHOP BD — সর্বস্বত্ব সংরক্ষিত" />
            </Field>
            <Field label="ফুটার পরিচিতি (দীর্ঘ লেখা)">
              <Textarea value={get('footer_about')} onChange={(e) => set('footer_about')(e.target.value)} rows={3} />
            </Field>
            <Field label="ফুটার COD লাইন" hint="নিচের বারে ডান পাশে দেখাবে — শেষ শব্দটি অরেঞ্জ বোল্ড হবে">
              <Input value={get('footer_cod_text')} onChange={(e) => set('footer_cod_text')(e.target.value)} placeholder="Cash on delivery all over Bangladesh" />
            </Field>
            <Field label="ইনভয়েস নোট" hint="প্রিন্ট করা প্রতিটি ইনভয়েসের নিচে দেখাবে">
              <Textarea value={get('invoice_note')} onChange={(e) => set('invoice_note')(e.target.value)} rows={2} placeholder="পণ্য গ্রহণের ৭ দিনের মধ্যে রিটার্ন করা যাবে।" />
            </Field>
          </Card>
          {renderSaveBar('সাধারণ সেটিংস', GENERAL_KEYS)}
        </TabsContent>

        {/* ═══════════ লোকালাইজেশন ═══════════ */}
        <TabsContent value="localization" className="mt-4 space-y-4">
          <Card title="ভাষা, কারেন্সি ও সময়" icon={Globe2}>
            <Field label="ডিফল্ট ভাষা" hint="বাংলা ডিফল্ট — ইংরেজি ভাষা সাপোর্ট ভবিষ্যতে আসবে">
              <Input value="বাংলা (bn)" disabled />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="কারেন্সি কোড">
                <Input value={get('currency_code')} onChange={(e) => set('currency_code')(e.target.value)} placeholder="BDT" />
              </Field>
              <Field label="কারেন্সি সিম্বল">
                <Input value={get('currency_symbol')} onChange={(e) => set('currency_symbol')(e.target.value)} placeholder="৳" />
              </Field>
            </div>
            <Field label="টাইমজোন">
              <Select value={get('timezone') || 'Asia/Dhaka'} onValueChange={set('timezone')}>
                <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="তারিখ ফরম্যাট">
              <Select value={get('date_format') || 'DD/MM/YYYY'} onValueChange={set('date_format')}>
                <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Card>
          {renderSaveBar('লোকালাইজেশন', LOCAL_KEYS)}
        </TabsContent>

        {/* ═══════════ ট্যাক্স ও প্রাইসিং ═══════════ */}
        <TabsContent value="tax" className="mt-4 space-y-4">
          <Card title="ট্যাক্স" icon={Percent}>
            <ToggleRow
              title="ট্যাক্স চালু"
              desc="চেকআউটে ট্যাক্স হিসাব যোগ হবে"
              checked={isOn('tax_enabled')}
              onChange={(v) => set('tax_enabled')(v ? '1' : '0')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ট্যাক্স (%)">
                <Input type="number" min={0} max={100} value={get('tax_percent')} onChange={(e) => set('tax_percent')(e.target.value)} placeholder="0" />
              </Field>
            </div>
            <ToggleRow
              title="দামের মধ্যে ট্যাক্স অন্তর্ভুক্ত"
              desc="অন্তর্ভুক্ত হলে প্রদর্শিত দামের মধ্যেই ট্যাক্স ধরা থাকবে — চেকআউটে আলাদা যোগ হবে না"
              checked={isOn('tax_inclusive')}
              onChange={(v) => set('tax_inclusive')(v ? '1' : '0')}
            />
          </Card>

          <Card title="অর্ডার শর্ত" icon={Percent}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="সর্বনিম্ন অর্ডার (৳)" hint="এর কম কার্টে চেকআউট করা যাবে না (০ = নেই)">
                <Input type="number" min={0} value={get('min_order_amount')} onChange={(e) => set('min_order_amount')(e.target.value)} />
              </Field>
              <Field label="ফ্রি ডেলিভারি শর্ত (৳)" hint="এই পরিমাণের সমান বা বেশি অর্ডারে ডেলিভারি ফ্রি (০ = নেই)">
                <Input type="number" min={0} value={get('free_shipping_threshold')} onChange={(e) => set('free_shipping_threshold')(e.target.value)} />
              </Field>
            </div>
          </Card>
          {renderSaveBar('ট্যাক্স ও প্রাইসিং', TAX_KEYS)}
        </TabsContent>

        {/* ═══════════ নোটিফিকেশন ═══════════ */}
        <TabsContent value="notification" className="mt-4 space-y-4">
          <Card title="কাস্টমার নোটিফিকেশন" icon={BellRing}>
            <ToggleRow
              title="অর্ডার আপডেট নোটিফিকেশন"
              desc="স্ট্যাটাস বদলালে কাস্টমার নোটিফিকেশন পাবে"
              checked={isOn('notif_order_enabled')}
              onChange={(v) => set('notif_order_enabled')(v ? '1' : '0')}
            />
            <ToggleRow
              title="প্রোমো ও অফার নোটিফিকেশন"
              desc="নতুন অফার ব্রডকাস্ট করলে জানানো হবে"
              checked={isOn('notif_promo_enabled')}
              onChange={(v) => set('notif_promo_enabled')(v ? '1' : '0')}
            />
            <ToggleRow
              title="স্টক নোটিফিকেশন"
              desc="পছন্দের পণ্য আবার স্টকে এলে জানানো হবে"
              checked={isOn('notif_stock_enabled')}
              onChange={(v) => set('notif_stock_enabled')(v ? '1' : '0')}
            />
          </Card>

          <Card title="SMTP (ইমেইল সার্ভার)" icon={BellRing}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="SMTP হোস্ট">
                <Input value={get('smtp_host')} onChange={(e) => set('smtp_host')(e.target.value)} placeholder="smtp.gmail.com" />
              </Field>
              <Field label="পোর্ট">
                <Input type="number" value={get('smtp_port')} onChange={(e) => set('smtp_port')(e.target.value)} placeholder="587" />
              </Field>
              <Field label="ইউজারনেম">
                <Input value={get('smtp_user')} onChange={(e) => set('smtp_user')(e.target.value)} placeholder="noreply@theshopbd.com" />
              </Field>
              <Field label="সেন্ডার ইমেইল">
                <Input value={get('smtp_sender_email')} onChange={(e) => set('smtp_sender_email')(e.target.value)} placeholder="THE SHOP BD <noreply@theshopbd.com>" />
              </Field>
              <Field label="পাসওয়ার্ড" hint="ভবিষ্যৎ ব্যাকএন্ড ইন্টিগ্রেশনের জন্য সংরক্ষিত — এখন সেট করা যাবে না">
                <Input type="password" value="••••••••" disabled />
              </Field>
            </div>
          </Card>

          <Card title="SMS গেটওয়ে" icon={MessageCircle}>
            <p className="text-sm text-muted-foreground">
              SMS গেটওয়ে কনফিগারেশন এখন <strong>ইন্টিগ্রেশন → SMS নোটিফিকেশন</strong> সেকশনে সম্পূর্ণ প্যানেলসহ আছে
              (Bulk SMS BD / SSL Wireless / কাস্টম API + টেমপ্লেট + লগ)।
            </p>
          </Card>
          {renderSaveBar('নোটিফিকেশন সেটিংস', NOTIF_KEYS)}
        </TabsContent>

        {/* ═══════════ SEO ═══════════ */}
        <TabsContent value="seo" className="mt-4 space-y-4">
          <Card title="সার্চ ইঞ্জিন অপটিমাইজেশন" icon={Search}>
            <Field label="SEO টাইটেল">
              <Input value={get('seo_title')} onChange={(e) => set('seo_title')(e.target.value)} placeholder="THE SHOP BD — অনলাইন শপিং" />
            </Field>
            <Field label="মেটা বর্ণনা">
              <Textarea value={get('seo_description')} onChange={(e) => set('seo_description')(e.target.value)} rows={3} placeholder="১০০% অরিজিনাল পণ্য, সারাদেশে হোম ডেলিভারি..." />
            </Field>
            <Field label="কীওয়ার্ড" hint="কমা দিয়ে আলাদা করুন">
              <Input value={get('seo_keywords')} onChange={(e) => set('seo_keywords')(e.target.value)} placeholder="অনলাইন শপিং, THE SHOP BD, ইলেকট্রনিকস..." />
            </Field>
            <ImageUploadField
              label="OG ইমেজ (সোশ্যাল শেয়ার)"
              hint="ফেসবুক/হোয়াটসঅ্যাপে লিঙ্ক শেয়ার করলে যে ছবি দেখাবে (১২০০×৬৩০ ভালো)"
              folder="site"
              aspect="wide"
              value={get('seo_og_image')}
              onChange={set('seo_og_image')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Google Site Verification">
                <Input value={get('seo_google_verification')} onChange={(e) => set('seo_google_verification')(e.target.value)} placeholder="google-site-verification=..." />
              </Field>
              <Field label="Analytics ID" hint="যেমন: G-XXXXXXX (GA4)">
                <Input value={get('seo_analytics_id')} onChange={(e) => set('seo_analytics_id')(e.target.value)} placeholder="G-XXXXXXXXXX" />
              </Field>
            </div>
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              নোট: ব্রাউজার ট্যাবের টাইটেল ও মেটাডেটা বর্তমানে layout.tsx-এ স্ট্যাটিকভাবে সেট করা — ভবিষ্যৎ ব্যাকএন্ডে এই মানগুলো ডায়নামিকভাবে ব্যবহৃত হবে।
            </p>
          </Card>
          {renderSaveBar('SEO সেটিংস', SEO_KEYS)}
        </TabsContent>

        {/* ═══════════ নিরাপত্তা ═══════════ */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <Card title="সেশন ও লগইন" icon={ShieldCheck}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="সেশন টাইমআউট (মিনিট)" hint="এই সময় নিষ্ক্রিয় থাকলে অ্যাডমিন সেশন শেষ হবে">
                <Input type="number" min={5} value={get('security_session_timeout')} onChange={(e) => set('security_session_timeout')(e.target.value)} />
              </Field>
              <Field label="সর্বোচ্চ লগইন চেষ্টা" hint="এর বেশি ভুল পাসওয়ার্ড দিলে সাময়িক ব্লক">
                <Input type="number" min={3} value={get('security_max_login_attempts')} onChange={(e) => set('security_max_login_attempts')(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="মেইনটেনেন্স মোড" icon={ShieldCheck}>
            <ToggleRow
              title="মেইনটেনেন্স মোড চালু"
              desc="মেইনটেনেন্স মোড চালু থাকলে সাইটের হোমপেজে ব্যানার দেখাবে"
              checked={isOn('security_maintenance_mode')}
              onChange={(v) => set('security_maintenance_mode')(v ? '1' : '0')}
            />
            <Field label="মেইনটেনেন্স বার্তা">
              <Textarea
                value={get('security_maintenance_message')}
                onChange={(e) => set('security_maintenance_message')(e.target.value)}
                rows={2}
                placeholder="আমরা সাইট আপগ্রেড করছি — খুব শিগগিরই ফিরে আসছি!"
              />
            </Field>
          </Card>
          {renderSaveBar('নিরাপত্তা সেটিংস', SECURITY_KEYS)}
        </TabsContent>

        {/* ═══════════ GitHub হোস্টিং ═══════════ */}
        <TabsContent value="github" className="mt-4">
          <GithubHostingTab set={set} get={get} saveTab={saveTab} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

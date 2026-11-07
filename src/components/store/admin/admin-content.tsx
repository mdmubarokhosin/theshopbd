'use client';

/**
 * অ্যাডমিন — হোমপেজ কনটেন্ট (CMS)
 * ---------------------------------------------------------------------------
 * ট্যাব: হিরো স্লাইড / সাইড ব্যানার / কেন আমরা / কাস্টমার মতামত /
 *       ঘোষণা ও পপআপ / সেকশন দৃশ্যমানতা
 * সব ডেটা localStorage DB-তে (slides, sideBanners, whyUs, testimonials, settings)।
 */

import { useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Star, Images, PanelRight, Award, Quote,
  Megaphone, Eye, Upload, ChevronUp, ChevronDown, Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { db, uid } from '@/lib/db/core';
import { useCollection, useSettings } from '@/lib/db/hooks';
import {
  saveSettings, saveAnnouncementItem, deleteAnnouncementItem, moveAnnouncementItem,
  logAudit, getCurrentUser,
} from '@/lib/db/services';
import type {
  BannerAction, Slide, SideBanner, WhyUsItem, Testimonial, SiteSettings, Announcement,
} from '@/lib/db/types';
import { formatBDT, toBn } from '@/lib/types';
import { BiIcon, FEATURE_ICON_PICKER } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { ImageUploadField } from './admin-ui';

function actorName(): string {
  return getCurrentUser()?.name || 'অ্যাডমিন';
}

// ───────────────────────────── শেয়ার্ড: অ্যাকশন এডিটর ─────────────────────────────

type ActionForm = {
  name: BannerAction['name'];
  category: string;
  productSlug: string;
  page: string;
  url: string;
};

const ACTION_NAME_BN: Record<BannerAction['name'], string> = {
  shop: 'ক্যাটাগরিতে যান',
  offers: 'অফার জোন',
  product: 'নির্দিষ্ট পণ্য',
  page: 'পেজ',
  url: 'কাস্টম লিঙ্ক',
};

function toActionForm(a?: BannerAction | null): ActionForm {
  return {
    name: a?.name || 'shop',
    category: a?.category || '',
    productSlug: a?.slug || '',
    page: a?.page || '',
    url: a?.url || '',
  };
}

function buildAction(a: ActionForm): BannerAction {
  const action: BannerAction = { name: a.name };
  if (a.name === 'shop' && a.category) action.category = a.category;
  if (a.name === 'product' && a.productSlug) action.slug = a.productSlug;
  if (a.name === 'page' && a.page) action.page = a.page;
  if (a.name === 'url' && a.url) action.url = a.url;
  return action;
}

function ActionEditor({ value, onChange }: { value: ActionForm; onChange: (v: ActionForm) => void }) {
  const categories = useCollection('categories');
  const pages = useCollection('pages');
  const products = useCollection('products');

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3">
      <div>
        <Label>বাটনে ক্লিক করলে কোথায় যাবে</Label>
        <Select value={value.name} onValueChange={(v) => onChange({ ...value, name: v as BannerAction['name'] })}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ACTION_NAME_BN) as BannerAction['name'][]).map((n) => (
              <SelectItem key={n} value={n}>{ACTION_NAME_BN[n]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.name === 'shop' && (
        <div>
          <Label>ক্যাটাগরি</Label>
          <Select value={value.category} onValueChange={(v) => onChange({ ...value, category: v })}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="ক্যাটাগরি বেছে নিন" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.slug}>{c.nameBn || c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.name === 'product' && (
        <div>
          <Label>পণ্যের স্লাগ</Label>
          <Input
            list="tsb-product-slugs"
            value={value.productSlug}
            onChange={(e) => onChange({ ...value, productSlug: e.target.value })}
            placeholder="symphony-g22"
            className="mt-1.5"
          />
          <datalist id="tsb-product-slugs">
            {products.map((p) => (
              <option key={p.id} value={p.slug}>{p.nameBn || p.name}</option>
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-muted-foreground">নিচের তালিকা থেকেও বেছে নিতে পারেন</p>
        </div>
      )}

      {value.name === 'page' && (
        <div>
          <Label>পেজ</Label>
          <Select value={value.page} onValueChange={(v) => onChange({ ...value, page: v })}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="পেজ বেছে নিন" /></SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.id} value={p.slug}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.name === 'url' && (
        <div>
          <Label>লিঙ্ক (URL)</Label>
          <Input
            value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
            placeholder="https://..."
            className="mt-1.5"
          />
        </div>
      )}

      {value.name === 'offers' && (
        <p className="text-xs text-muted-foreground">অফার জোন পেজে নিয়ে যাবে — অতিরিক্ত কিছু দিতে হবে না।</p>
      )}
    </div>
  );
}

// ───────────────────────────── শেয়ার্ড: ছোট পিস ─────────────────────────────

function ThemeChip({ theme }: { theme: number }) {
  return (
    <Badge variant="outline" className="text-[10px]">
      থিম {toBn(theme)}
    </Badge>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
      <Icon className="mb-2 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ThemeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>থিম</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="0">থিম ০</SelectItem>
          <SelectItem value="1">থিম ১</SelectItem>
          <SelectItem value="2">থিম ২</SelectItem>
          <SelectItem value="3">থিম ৩</SelectItem>
        </SelectContent>
      </Select>
      <p className="mt-1 text-[11px] text-muted-foreground">হিরো কার্ডের রঙ ও স্টাইল বদলায় (০-৩)</p>
    </div>
  );
}

// ═══════════════════════════ হিরো স্লাইড ═══════════════════════════

type SlideForm = {
  theme: string;
  store: string;
  title: string;
  tagline: string;
  priceFrom: string;
  discount: string;
  cta: string;
  photos: string[];
  action: ActionForm;
  active: boolean;
  sortOrder: string;
};

function emptySlideForm(storeTitle: string): SlideForm {
  return {
    theme: '0', store: storeTitle, title: '', tagline: '', priceFrom: '', discount: '',
    cta: 'এখনই কিনুন', photos: ['', '', ''], action: toActionForm({ name: 'shop' }),
    active: true, sortOrder: '0',
  };
}

function SlideManager() {
  const { toast } = useToast();
  const settings = useSettings();
  const slidesRaw = useCollection('slides');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Slide | null>(null);
  const [form, setForm] = useState<SlideForm>(() => emptySlideForm('THE SHOP BD'));
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Slide | null>(null);

  const slides = useMemo(() => [...slidesRaw].sort((a, b) => a.sortOrder - b.sortOrder), [slidesRaw]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptySlideForm(settings.site_title || 'THE SHOP BD'));
    setDialogOpen(true);
  };

  const openEdit = (s: Slide) => {
    setEditing(s);
    setForm({
      theme: String(s.theme ?? 0),
      store: s.store || '',
      title: s.title || '',
      tagline: s.tagline || '',
      priceFrom: s.priceFrom != null ? String(s.priceFrom) : '',
      discount: s.discount || '',
      cta: s.cta || '',
      photos: [s.photos?.[0] || '', s.photos?.[1] || '', s.photos?.[2] || ''],
      action: toActionForm(s.action),
      active: s.active,
      sortOrder: String(s.sortOrder ?? 0),
    });
    setDialogOpen(true);
  };

  const setPhoto = (i: number, url: string) => {
    const photos = [...form.photos];
    photos[i] = url;
    setForm({ ...form, photos });
  };

  const save = () => {
    if (!form.title.trim() || !form.cta.trim()) {
      toast({ title: 'শিরোনাম ও বাটনের লেখা দিন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const slide: Slide = {
      id: editing?.id || uid('slide_'),
      theme: Number(form.theme) || 0,
      store: form.store.trim() || settings.site_title || 'THE SHOP BD',
      title: form.title,
      tagline: form.tagline.trim(),
      priceFrom: form.priceFrom ? Number(form.priceFrom) : null,
      discount: form.discount.trim() || null,
      cta: form.cta.trim(),
      photos: [form.photos[0] || '', form.photos[1] || '', form.photos[2] || ''],
      action: buildAction(form.action),
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
    };
    db.put('slides', slide);
    logAudit({
      actor: actorName(), action: editing ? 'slide.update' : 'slide.create',
      entity: 'slide', entityId: slide.id, details: slide.title.replace('\n', ' '),
    });
    setSaving(false);
    setDialogOpen(false);
    toast({ title: editing ? 'স্লাইড আপডেট হয়েছে' : 'স্লাইড যোগ হয়েছে' });
  };

  const toggleActive = (s: Slide, active: boolean) => {
    db.put('slides', { ...s, active });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    db.remove('slides', deleteTarget.id);
    logAudit({ actor: actorName(), action: 'slide.delete', entity: 'slide', entityId: deleteTarget.id, details: deleteTarget.title });
    toast({ title: 'স্লাইড মুছে ফেলা হয়েছে' });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">হিরো স্লাইড</h3>
          <p className="text-xs text-muted-foreground">হোমপেজের উপরের বড় স্লাইডার — ছবি, অফার ও বাটন</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন স্লাইড
        </Button>
      </div>

      {slides.length === 0 ? (
        <EmptyState icon={Images} text="কোনো স্লাইড নেই — নতুন স্লাইড যোগ করুন" />
      ) : (
        <div className="space-y-2">
          {slides.map((s) => (
            <div key={s.id} className={cn('flex flex-col gap-2.5 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:gap-3', !s.active && 'opacity-60')}>
              <div className="flex gap-1 sm:shrink-0">
                {(s.photos ?? []).map((p, i) => (
                  <div key={i} className="h-12 w-16 overflow-hidden rounded-md border bg-white">
                    {p ? <img src={p} alt={`স্লাইড ছবি ${toBn(i + 1)}`} className="h-full w-full object-cover" /> : null}
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="whitespace-pre-line text-sm font-bold">{s.title}</span>
                  <ThemeChip theme={s.theme} />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.tagline}
                  {s.priceFrom != null && s.priceFrom > 0 ? ` • ${formatBDT(s.priceFrom)} থেকে` : ''}
                  {s.discount ? ` • ${s.discount}` : ''}
                  {' • ক্রম: '}
                  {toBn(s.sortOrder)}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 sm:shrink-0 sm:justify-start">
                <Switch checked={s.active} onCheckedChange={(v) => toggleActive(s, v)} aria-label="স্লাইড সক্রিয় টগল" />
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} aria-label="সম্পাদনা">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline" size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(s)} aria-label="মুছুন"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* স্লাইড এডিটর */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'স্লাইড সম্পাদনা' : 'নতুন স্লাইড'}</DialogTitle>
            <DialogDescription>হোমপেজ হিরো স্লাইডারের কনটেন্ট</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ThemeSelect value={form.theme} onChange={(v) => setForm({ ...form, theme: v })} />
              <div>
                <Label>স্টোর নাম (ছোট লেখা)</Label>
                <Input value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>সর্ট অর্ডার</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label>শিরোনাম <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                rows={2}
                placeholder={'সামার স্মার্টফোন\nমেগা ডিল'}
                className="mt-1.5"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">শিরোনামে \n দিলে দুই লাইনে দেখাবে</p>
            </div>

            <div>
              <Label>ট্যাগলাইন</Label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="Samsung • Xiaomi • Walton — অরিজিনাল ওয়ারেন্টি সহ"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>দাম থেকে (৳, ঐচ্ছিক)</Label>
                <Input type="number" value={form.priceFrom} onChange={(e) => setForm({ ...form, priceFrom: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>ডিসকাউন্ট ব্যাজ (ঐচ্ছিক)</Label>
                <Input value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="-৩৫% বা ফ্রি" className="mt-1.5" />
              </div>
              <div>
                <Label>বাটনের লেখা <span className="text-destructive">*</span></Label>
                <Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} className="mt-1.5" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="mb-2 text-xs font-semibold text-muted-foreground">ছবি {toBn(i + 1)}</div>
                  <ImageUploadField
                    value={form.photos[i] || ''}
                    onChange={(url) => setPhoto(i, url)}
                    folder="products"
                    aspect="wide"
                  />
                  <Input
                    value={form.photos[i] || ''}
                    onChange={(e) => setPhoto(i, e.target.value)}
                    placeholder="অথবা পাথ: /products/earbuds.png"
                    className="mt-2 h-8 text-xs"
                  />
                </div>
              ))}
            </div>

            <ActionEditor value={form.action} onChange={(action) => setForm({ ...form, action })} />

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="text-sm font-semibold">সক্রিয়</div>
                <div className="text-xs text-muted-foreground">হোমপেজে দেখা যাবে</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} aria-label="স্লাইড সক্রিয় টগল" />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> সেভ হচ্ছে...</> : editing ? 'আপডেট করুন' : 'যোগ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ডিলিট কনফার্ম */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>স্লাইডটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই স্লাইড স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════ সাইড ব্যানার ═══════════════════════════

type SideBannerForm = {
  theme: string;
  title: string;
  tagline: string;
  subtitle: string;
  photo: string;
  action: ActionForm;
  active: boolean;
  sortOrder: string;
};

function SideBannerManager() {
  const { toast } = useToast();
  const bannersRaw = useCollection('sideBanners');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SideBanner | null>(null);
  const [form, setForm] = useState<SideBannerForm>({
    theme: '0', title: '', tagline: '', subtitle: '', photo: '',
    action: toActionForm({ name: 'offers' }), active: true, sortOrder: '0',
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SideBanner | null>(null);

  const banners = useMemo(() => [...bannersRaw].sort((a, b) => a.sortOrder - b.sortOrder), [bannersRaw]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      theme: '0', title: '', tagline: '', subtitle: '', photo: '',
      action: toActionForm({ name: 'offers' }), active: true, sortOrder: String(banners.length + 1),
    });
    setDialogOpen(true);
  };

  const openEdit = (b: SideBanner) => {
    setEditing(b);
    setForm({
      theme: String(b.theme ?? 0),
      title: b.title || '',
      tagline: b.tagline || '',
      subtitle: b.subtitle || '',
      photo: b.photo || '',
      action: toActionForm(b.action),
      active: b.active,
      sortOrder: String(b.sortOrder ?? 0),
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.title.trim() || !form.tagline.trim()) {
      toast({ title: 'শিরোনাম ও ট্যাগলাইন দিন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const banner: SideBanner = {
      id: editing?.id || uid('side_'),
      theme: Number(form.theme) || 0,
      title: form.title.trim(),
      tagline: form.tagline.trim(),
      subtitle: form.subtitle.trim() || null,
      photo: form.photo || null,
      action: buildAction(form.action),
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
    };
    db.put('sideBanners', banner);
    logAudit({
      actor: actorName(), action: editing ? 'side_banner.update' : 'side_banner.create',
      entity: 'sideBanner', entityId: banner.id, details: banner.title,
    });
    setSaving(false);
    setDialogOpen(false);
    toast({ title: editing ? 'সাইড ব্যানার আপডেট হয়েছে' : 'সাইড ব্যানার যোগ হয়েছে' });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    db.remove('sideBanners', deleteTarget.id);
    logAudit({ actor: actorName(), action: 'side_banner.delete', entity: 'sideBanner', entityId: deleteTarget.id, details: deleteTarget.title });
    toast({ title: 'সাইড ব্যানার মুছে ফেলা হয়েছে' });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">সাইড ব্যানার</h3>
          <p className="text-xs text-muted-foreground">হিরো স্লাইডারের পাশের ছোট ব্যানারগুলো</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন ব্যানার
        </Button>
      </div>

      {banners.length === 0 ? (
        <EmptyState icon={PanelRight} text="কোনো সাইড ব্যানার নেই" />
      ) : (
        <div className="space-y-2">
          {banners.map((b) => (
            <div key={b.id} className={cn('flex flex-col gap-2.5 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:gap-3', !b.active && 'opacity-60')}>
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border bg-white">
                {b.photo ? <img src={b.photo} alt={b.title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">{b.title}</span>
                  <ThemeChip theme={b.theme} />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {b.tagline}{b.subtitle ? ` • ${b.subtitle}` : ''} • ক্রম: {toBn(b.sortOrder)}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 sm:shrink-0 sm:justify-start">
                <Switch checked={b.active} onCheckedChange={(v) => db.put('sideBanners', { ...b, active: v })} aria-label="ব্যানার সক্রিয় টগল" />
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(b)} aria-label="সম্পাদনা">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline" size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(b)} aria-label="মুছুন"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ব্যানার এডিটর */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'সাইড ব্যানার সম্পাদনা' : 'নতুন সাইড ব্যানার'}</DialogTitle>
            <DialogDescription>হিরো সেকশনের ডান পাশে দেখানো ছোট ব্যানার</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ThemeSelect value={form.theme} onChange={(v) => setForm({ ...form, theme: v })} />
              <div>
                <Label>সর্ট অর্ডার</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>শিরোনাম <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>ট্যাগলাইন <span className="text-destructive">*</span></Label>
              <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>সাব-টেক্সট (ঐচ্ছিক)</Label>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <ImageUploadField
                label="ব্যানার ছবি"
                hint="ওয়াইড ক্রপে দেখানো হবে"
                folder="products"
                aspect="wide"
                value={form.photo}
                onChange={(url) => setForm({ ...form, photo: url })}
              />
              <Input
                value={form.photo}
                onChange={(e) => setForm({ ...form, photo: e.target.value })}
                placeholder="অথবা পাথ: /products/backpack.png"
                className="mt-2 h-8 text-xs"
              />
            </div>
            <ActionEditor value={form.action} onChange={(action) => setForm({ ...form, action })} />
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="text-sm font-semibold">সক্রিয়</div>
                <div className="text-xs text-muted-foreground">হোমপেজে দেখা যাবে</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} aria-label="ব্যানার সক্রিয় টগল" />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> সেভ হচ্ছে...</> : editing ? 'আপডেট করুন' : 'যোগ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ব্যানারটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই সাইড ব্যানার স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════ কেন আমরা ═══════════════════════════

type WhyUsForm = {
  icon: string;
  title: string;
  text: string;
  active: boolean;
  sortOrder: string;
};

function WhyUsManager() {
  const { toast } = useToast();
  const whyRaw = useCollection('whyUs');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WhyUsItem | null>(null);
  const [form, setForm] = useState<WhyUsForm>({ icon: 'bi-truck', title: '', text: '', active: true, sortOrder: '0' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WhyUsItem | null>(null);

  const items = useMemo(() => [...whyRaw].sort((a, b) => a.sortOrder - b.sortOrder), [whyRaw]);

  const openCreate = () => {
    setEditing(null);
    setForm({ icon: 'bi-truck', title: '', text: '', active: true, sortOrder: String(items.length + 1) });
    setDialogOpen(true);
  };

  const openEdit = (w: WhyUsItem) => {
    setEditing(w);
    setForm({
      icon: w.icon || 'bi-truck',
      title: w.title || '',
      text: w.text || '',
      active: w.active,
      sortOrder: String(w.sortOrder ?? 0),
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.title.trim() || !form.text.trim()) {
      toast({ title: 'শিরোনাম ও বর্ণনা দিন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const item: WhyUsItem = {
      id: editing?.id || uid('why_'),
      icon: form.icon,
      title: form.title.trim(),
      text: form.text.trim(),
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
    };
    db.put('whyUs', item);
    logAudit({
      actor: actorName(), action: editing ? 'whyus.update' : 'whyus.create',
      entity: 'whyUs', entityId: item.id, details: item.title,
    });
    setSaving(false);
    setDialogOpen(false);
    toast({ title: editing ? 'ফিচার আপডেট হয়েছে' : 'ফিচার যোগ হয়েছে' });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    db.remove('whyUs', deleteTarget.id);
    logAudit({ actor: actorName(), action: 'whyus.delete', entity: 'whyUs', entityId: deleteTarget.id, details: deleteTarget.title });
    toast({ title: 'ফিচার মুছে ফেলা হয়েছে' });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">কেন আমরা</h3>
          <p className="text-xs text-muted-foreground">হোমপেজের &quot;কেন THE SHOP BD?&quot; ফিচার কার্ডগুলো</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন ফিচার
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Award} text="কোনো ফিচার নেই" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((w) => (
            <div key={w.id} className={cn('flex items-start gap-3 rounded-xl border bg-card p-3', !w.active && 'opacity-60')}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl text-primary">
                <BiIcon name={w.icon} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{w.title}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground">{w.text}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">ক্রম: {toBn(w.sortOrder)}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Switch checked={w.active} onCheckedChange={(v) => db.put('whyUs', { ...w, active: v })} aria-label="ফিচার সক্রিয় টগল" />
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEdit(w)} aria-label="সম্পাদনা">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline" size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(w)} aria-label="মুছুন"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ফিচার এডিটর */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'ফিচার সম্পাদনা' : 'নতুন ফিচার'}</DialogTitle>
            <DialogDescription>আইকন, শিরোনাম ও সংক্ষিপ্ত বর্ণনা</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>আইকন</Label>
              <div className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1.5 sm:grid-cols-10">
                {FEATURE_ICON_PICKER.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setForm({ ...form, icon: ic })}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors',
                      form.icon === ic ? 'border-primary bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent'
                    )}
                    aria-label={`আইকন ${ic}`}
                  >
                    <BiIcon name={ic} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>শিরোনাম <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="১০০% অরিজিনাল পণ্য" className="mt-1.5" />
            </div>
            <div>
              <Label>বর্ণনা <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                rows={2}
                placeholder="সব পণ্য সরাসরি ব্র্যান্ড থেকে সংগ্রহ করা"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>সর্ট অর্ডার</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>সক্রিয়</Label>
                <label className="mt-1.5 flex h-9 cursor-pointer items-center gap-2 text-sm">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} aria-label="ফিচার সক্রিয় টগল" />
                  {form.active ? 'দেখানো হবে' : 'লুকানো থাকবে'}
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> সেভ হচ্ছে...</> : editing ? 'আপডেট করুন' : 'যোগ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ফিচারটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{deleteTarget?.title}&quot; স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════ কাস্টমার মতামত ═══════════════════════════

type TestimonialForm = {
  name: string;
  role: string;
  text: string;
  rating: number;
  avatar: string;
  active: boolean;
  sortOrder: string;
};

function TestimonialsManager() {
  const { toast } = useToast();
  const tstRaw = useCollection('testimonials');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<TestimonialForm>({ name: '', role: '', text: '', rating: 5, avatar: '', active: true, sortOrder: '0' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);

  const items = useMemo(() => [...tstRaw].sort((a, b) => a.sortOrder - b.sortOrder), [tstRaw]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', role: '', text: '', rating: 5, avatar: '', active: true, sortOrder: String(items.length + 1) });
    setDialogOpen(true);
  };

  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({
      name: t.name || '',
      role: t.role || '',
      text: t.text || '',
      rating: t.rating || 5,
      avatar: t.avatar || '',
      active: t.active,
      sortOrder: String(t.sortOrder ?? 0),
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.text.trim()) {
      toast({ title: 'নাম ও মতামত দিন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const item: Testimonial = {
      id: editing?.id || uid('tst_'),
      name: form.name.trim(),
      role: form.role.trim() || null,
      text: form.text.trim(),
      rating: Math.min(5, Math.max(1, form.rating || 5)),
      avatar: form.avatar || null,
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
    };
    db.put('testimonials', item);
    logAudit({
      actor: actorName(), action: editing ? 'testimonial.update' : 'testimonial.create',
      entity: 'testimonial', entityId: item.id, details: item.name,
    });
    setSaving(false);
    setDialogOpen(false);
    toast({ title: editing ? 'মতামত আপডেট হয়েছে' : 'মতামত যোগ হয়েছে' });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    db.remove('testimonials', deleteTarget.id);
    logAudit({ actor: actorName(), action: 'testimonial.delete', entity: 'testimonial', entityId: deleteTarget.id, details: deleteTarget.name });
    toast({ title: 'মতামত মুছে ফেলা হয়েছে' });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">কাস্টমার মতামত</h3>
          <p className="text-xs text-muted-foreground">হোমপেজে দেখানো রিভিউ কার্ডগুলো</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন মতামত
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Quote} text="কোনো মতামত নেই" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((t) => (
            <div key={t.id} className={cn('flex items-start gap-3 rounded-xl border bg-card p-3', !t.active && 'opacity-60')}>
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-muted">
                {t.avatar ? (
                  <img src={t.avatar} alt={t.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
                    {(t.name || '•').slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">{t.name}</span>
                  {t.role && <span className="text-xs text-muted-foreground">({t.role})</span>}
                </div>
                <StarsRow rating={t.rating} />
                <p className="line-clamp-2 text-xs text-muted-foreground">{t.text}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Switch checked={t.active} onCheckedChange={(v) => db.put('testimonials', { ...t, active: v })} aria-label="মতামত সক্রিয় টগল" />
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEdit(t)} aria-label="সম্পাদনা">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline" size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(t)} aria-label="মুছুন"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* মতামত এডিটর */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'মতামত সম্পাদনা' : 'নতুন মতামত'}</DialogTitle>
            <DialogDescription>কাস্টমারের নাম, ছবি ও মতামত</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>নাম <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="শারমিন আক্তার" className="mt-1.5" />
              </div>
              <div>
                <Label>এলাকা / পরিচয় (ঐচ্ছিক)</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="মিরপুর, ঢাকা" className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>মতামত <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                rows={3}
                placeholder="পণ্যের মান আর সার্ভিস দুটোই দারুণ..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>রেটিং</Label>
              <div className="mt-1.5 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, rating: n })}
                    aria-label={`${toBn(n)} স্টার`}
                    className="rounded p-0.5 transition-transform hover:scale-110"
                  >
                    <Star className={cn('h-6 w-6', n <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <ImageUploadField
                label="ছবি (ঐচ্ছিক)"
                hint="কাস্টমারের ছোট গোল প্রোফাইল ছবি"
                folder="site"
                aspect="square"
                value={form.avatar}
                onChange={(url) => setForm({ ...form, avatar: url })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>সর্ট অর্ডার</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>সক্রিয়</Label>
                <label className="mt-1.5 flex h-9 cursor-pointer items-center gap-2 text-sm">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} aria-label="মতামত সক্রিয় টগল" />
                  {form.active ? 'দেখানো হবে' : 'লুকানো থাকবে'}
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> সেভ হচ্ছে...</> : editing ? 'আপডেট করুন' : 'যোগ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>মতামতটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name} এর মতামত স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StarsRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`রেটিং ${toBn(rating)} এর মধ্যে ৫`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn('h-3 w-3', i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </span>
  );
}

// ═══════════════════════════ স্লাইডিং ঘোষণা ম্যানেজার ═══════════════════════════

/** ঘোষণার জন্য দ্রুত আইকন পিকার (bootstrap icons) */
const ANNOUNCEMENT_ICONS: string[] = [
  'bi-megaphone', 'bi-truck', 'bi-gift', 'bi-patch-check-fill', 'bi-telephone-fill',
  'bi-credit-card-fill', 'bi-shop', 'bi-fire', 'bi-star-fill', 'bi-percent',
  'bi-lightning-charge-fill', 'bi-alarm', 'bi-box-seam', 'bi-tag-fill', 'bi-bell-fill', 'bi-heart-fill',
];

function AnnouncementsManager() {
  const { toast } = useToast();
  const settings = useSettings();
  const items = useCollection('announcements');
  const sorted = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder), [items]);
  const masterOn = settings.announcement_enabled === '1';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ icon: 'bi-megaphone', text: '', link: '' });

  const openAdd = () => {
    setEditing(null);
    setForm({ icon: 'bi-megaphone', text: '', link: '' });
    setDialogOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ icon: a.icon, text: a.text, link: a.link || '' });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.text.trim()) {
      toast({ title: 'ঘোষণার লেখা লিখুন', variant: 'destructive' });
      return;
    }
    saveAnnouncementItem({
      id: editing?.id ?? uid('ann'),
      icon: form.icon.trim() || 'bi-megaphone',
      text: form.text.trim(),
      link: form.link.trim() || null,
      enabled: editing?.enabled ?? true,
      sortOrder: editing?.sortOrder ?? sorted.length + 1,
    });
    setDialogOpen(false);
    toast({
      title: editing ? 'ঘোষণা আপডেট হয়েছে' : 'ঘোষণা যোগ হয়েছে',
      description: 'সাইটের একদম উপরের স্লাইডিং বারে দেখা যাবে',
    });
  };

  const toggleMaster = (v: boolean) => {
    saveSettings({ announcement_enabled: v ? '1' : '0' });
    toast({ title: v ? 'ঘোষণা বার চালু হয়েছে' : 'ঘোষণা বার বন্ধ হয়েছে', description: v ? 'স্লাইডিং লেখাগুলো আবার দেখা যাবে' : 'সাইট থেকে পুরো বার লুকিয়ে গেছে' });
  };

  const toggleItem = (a: Announcement, v: boolean) => {
    saveAnnouncementItem({ ...a, enabled: v });
    toast({ title: v ? 'ঘোষণা চালু হয়েছে' : 'ঘোষণা বন্ধ হয়েছে' });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteAnnouncementItem(deleteTarget.id, deleteTarget.text);
    setDeleteTarget(null);
    toast({ title: 'ঘোষণা মুছে ফেলা হয়েছে' });
  };

  return (
    <div className="min-w-0 rounded-xl border bg-card p-4 sm:p-5 lg:col-span-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Megaphone className="h-4 w-4 text-primary" /> স্লাইডিং ঘোষণা বার
        </h3>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-4 w-4" /> নতুন ঘোষণা
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        সাইটের একদম উপরে যে লেখাগুলো স্লাইড হয় — এখান থেকে যোগ, এডিট, ডিলিট, ক্রম পরিবর্তন ও চালু/বন্ধ করুন
      </p>

      {/* মাস্টার সুইচ */}
      <label className="mb-4 flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
        <div>
          <div className="text-sm font-semibold">ঘোষণা বার চালু</div>
          <div className="text-xs text-muted-foreground">বন্ধ করলে পুরো স্লাইডিং বার সাইট থেকে লুকিয়ে যাবে</div>
        </div>
        <Switch checked={masterOn} onCheckedChange={toggleMaster} aria-label="ঘোষণা বার মাস্টার সুইচ" />
      </label>

      {/* তালিকা */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Megaphone className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">কোনো ঘোষণা নেই — &quot;নতুন ঘোষণা&quot; বাটনে যোগ করুন</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((a, i) => (
            <li
              key={a.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border p-2.5 transition-opacity sm:gap-3',
                !a.enabled && 'opacity-55'
              )}
            >
              {/* ক্রম */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveAnnouncementItem(a.id, -1)}
                  disabled={i === 0}
                  aria-label="উপরে সরান"
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveAnnouncementItem(a.id, 1)}
                  disabled={i === sorted.length - 1}
                  aria-label="নিচে সরান"
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* আইকন */}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BiIcon name={a.icon} />
              </span>

              {/* লেখা + লিঙ্ক */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" title={a.text}>{a.text}</div>
                {a.link ? (
                  <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <Link2 className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">{a.link}</span>
                  </div>
                ) : null}
              </div>

              {/* চালু/বন্ধ */}
              <Switch
                checked={a.enabled}
                onCheckedChange={(v) => toggleItem(a, v)}
                aria-label={`"${(a.text || '').slice(0, 20)}" ঘোষণা চালু টগল`}
              />

              {/* এডিট / ডিলিট */}
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEdit(a)} aria-label="ঘোষণা এডিট করুন">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(a)} aria-label="ঘোষণা মুছে ফেলুন">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* যোগ/এডিট ডায়ালগ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'ঘোষণা এডিট করুন' : 'নতুন ঘোষণা যোগ করুন'}</DialogTitle>
            <DialogDescription>
              লেখাটি সাইটের উপরের স্লাইডিং বারে ঘুরে দেখাবে
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* লাইভ প্রিভিউ */}
            <div className="flex items-center gap-1.5 rounded-md bg-brand-dark px-3 py-2 text-xs text-primary-foreground" data-selectable>
              <BiIcon name={form.icon || 'bi-megaphone'} className="text-sm" />
              <span className="truncate">{form.text.trim() || 'এখানে ঘোষণার লেখা দেখাবে…'}</span>
            </div>

            <div>
              <Label>আইকন</Label>
              <div className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1.5">
                {ANNOUNCEMENT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm({ ...form, icon })}
                    aria-label={icon}
                    aria-pressed={form.icon === icon}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-lg border text-base transition-colors',
                      form.icon === icon
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:border-primary/40 hover:text-primary'
                    )}
                  >
                    <BiIcon name={icon} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>ঘোষণার লেখা</Label>
              <Textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                rows={2}
                placeholder="ঈদ ধমাকা সেল চলছে — ৫০% পর্যন্ত ছাড়!"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>লিঙ্ক (ঐচ্ছিক — ক্লিক করলে যাবে)</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="/shop?offers=1 বা https://..."
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={save}>
              {editing ? 'আপডেট করুন' : 'যোগ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ডিলিট কনফার্মেশন */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ঘোষণাটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{deleteTarget?.text}&quot; স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PopupSettingsCard({ prefix, titleText, desc }: { prefix: 'popup_notice' | 'popup_offer'; titleText: string; desc: string }) {
  const { toast } = useToast();
  const settings = useSettings();
  const [saving, setSaving] = useState(false);

  const formFromSettings = () => ({
    enabled: settings[`${prefix}_enabled`] === '1',
    type: settings[`${prefix}_type`] || 'text',
    title: settings[`${prefix}_title`] || '',
    message: settings[`${prefix}_message`] || '',
    image: settings[`${prefix}_image`] || '',
    buttonText: settings[`${prefix}_button_text`] || '',
    link: settings[`${prefix}_link`] || '',
  });

  const [form, setForm] = useState(formFromSettings);
  const [dirty, setDirty] = useState(false);

  // RTDB/ক্রস-ট্যাব সিঙ্কে settings বদলালে ফর্ম স্টেল হয়ে যায় —
  // ইউজার নিজে কিছু না এডিট করলে (dirty না হলে) সর্বশেষ ভ্যালু দিয়ে রি-সিঙ্ক হয়
  const [syncedSettings, setSyncedSettings] = useState(settings);
  if (syncedSettings !== settings) {
    setSyncedSettings(settings);
    if (!dirty) setForm(formFromSettings());
  }

  const update = (patch: Partial<ReturnType<typeof formFromSettings>>) => {
    setDirty(true);
    setForm((f) => ({ ...f, ...patch }));
  };

  const save = () => {
    setSaving(true);
    saveSettings({
      [`${prefix}_enabled`]: form.enabled ? '1' : '0',
      [`${prefix}_type`]: form.type,
      [`${prefix}_title`]: form.title,
      [`${prefix}_message`]: form.message,
      [`${prefix}_image`]: form.image,
      [`${prefix}_button_text`]: form.buttonText,
      [`${prefix}_link`]: form.link,
    } as Partial<SiteSettings>);
    setSaving(false);
    setDirty(false);
    toast({ title: `${titleText} সেভ হয়েছে` });
  };

  return (
    <div className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
        <Upload className="h-4 w-4 text-primary" /> {titleText}
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">{desc}</p>
      <div className="grid gap-4">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <div className="text-sm font-semibold">পপআপ চালু</div>
            <div className="text-xs text-muted-foreground">হোমপেজ ভিজিটরকে দেখানো হবে</div>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => update({ enabled: v })} aria-label={`${titleText} চালু টগল`} />
        </label>

        <div className={cn('grid gap-4', !form.enabled && 'pointer-events-none opacity-50')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>ধরন</Label>
              <Select value={form.type} onValueChange={(v) => update({ type: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">শুধু লেখা</SelectItem>
                  <SelectItem value="image">ইমেজ সহ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>টাইটেল</Label>
              <Input
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder={prefix === 'popup_notice' ? 'নোটিশ' : 'বিশেষ অফার!'}
                className="mt-1.5"
              />
            </div>
          </div>

          {form.type === 'text' ? (
            <div>
              <Label>বার্তা</Label>
              <Textarea
                value={form.message}
                onChange={(e) => update({ message: e.target.value })}
                rows={3}
                placeholder="পপআপে যে লেখা দেখাবে..."
                className="mt-1.5"
              />
            </div>
          ) : (
            <div>
              <ImageUploadField
                label="পপআপ ইমেজ"
                hint="পপআপের উপরে বড় করে দেখাবে (JPG/PNG/SVG)"
                folder="popup"
                aspect="wide"
                value={form.image}
                onChange={(url) => update({ image: url })}
              />
              <Input
                value={form.image}
                onChange={(e) => update({ image: e.target.value })}
                placeholder="অথবা পাথ/URL দিন"
                className="mt-2 h-8 text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>বাটনের লেখা</Label>
              <Input
                value={form.buttonText}
                onChange={(e) => update({ buttonText: e.target.value })}
                placeholder={prefix === 'popup_notice' ? 'ঠিক আছে' : 'অফার দেখুন'}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>বাটন লিঙ্ক (ঐচ্ছিক)</Label>
              <Input
                value={form.link}
                onChange={(e) => update({ link: e.target.value })}
                placeholder="offers বা https://..."
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full gap-1.5 font-semibold sm:w-auto sm:self-start">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} সেভ করুন
        </Button>
      </div>
    </div>
  );
}

function AnnouncementPopupManager() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AnnouncementsManager />
      <PopupSettingsCard
        prefix="popup_notice"
        titleText="পপআপ নোটিশ"
        desc="সাইটে প্রথমবার ঢুকলে দেখানো নোটিশ পপআপ (লেখা বা ইমেজ)"
      />
      <PopupSettingsCard
        prefix="popup_offer"
        titleText="পপআপ অফার"
        desc="অফার প্রমোশনের পপআপ (লেখা বা ইমেজ)"
      />
    </div>
  );
}

// ═══════════════════════════ সেকশন দৃশ্যমানতা ═══════════════════════════

const SECTION_ROWS: { key: keyof SiteSettings; title: string; desc: string }[] = [
  { key: 'section_categories', title: 'ক্যাটাগরি সেকশন', desc: 'হোমপেজে ক্যাটাগরি গ্রিড' },
  { key: 'section_brands', title: 'জনপ্রিয় ব্র্যান্ড সেকশন', desc: 'ব্র্যান্ড লোগোর সারি' },
  { key: 'section_why', title: 'কেন আমরা সেকশন', desc: 'ফিচার কার্ডগুলো' },
  { key: 'section_testimonials', title: 'কাস্টমার মতামত সেকশন', desc: 'রিভিউ কার্ডগুলো' },
  { key: 'section_payment', title: 'পেমেন্ট মেথড সেকশন', desc: 'পেমেন্ট লোগোর সারি' },
  { key: 'section_recently_viewed', title: 'সম্প্রতি দেখা পণ্য', desc: 'ভিজিটরের দেখা শেষ পণ্যগুলো' },
];

function SectionVisibilityManager() {
  const { toast } = useToast();
  const settings = useSettings();

  const toggle = (key: keyof SiteSettings, title: string, v: boolean) => {
    saveSettings({ [key]: v ? '1' : '0' } as Partial<SiteSettings>);
    toast({ title: `${title} ${v ? 'চালু' : 'বন্ধ'} হয়েছে` });
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold">সেকশন দৃশ্যমানতা</h3>
        <p className="text-xs text-muted-foreground">হোমপেজের কোন কোন সেকশন দেখাবে তা বেছে নিন — টগল করলেই সেভ হয়</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SECTION_ROWS.map((row) => (
          <label key={row.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{row.title}</div>
              <div className="text-xs text-muted-foreground">{row.desc}</div>
            </div>
            <Switch
              checked={settings[row.key] === '1'}
              onCheckedChange={(v) => toggle(row.key, row.title, v)}
              aria-label={`${row.title} টগল`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════ মূল এক্সপোর্ট ═══════════════════════════

export function AdminContent() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">হোমপেজ কনটেন্ট</h2>
        <p className="text-xs text-muted-foreground">হিরো স্লাইড, ব্যানার, ফিচার, মতামত, ঘোষণা — সব এক জায়গা থেকে</p>
      </div>

      <Tabs defaultValue="slides">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="slides">হিরো স্লাইড</TabsTrigger>
          <TabsTrigger value="sidebanners">সাইড ব্যানার</TabsTrigger>
          <TabsTrigger value="why">কেন আমরা</TabsTrigger>
          <TabsTrigger value="testimonials">কাস্টমার মতামত</TabsTrigger>
          <TabsTrigger value="announce">ঘোষণা ও পপআপ</TabsTrigger>
          <TabsTrigger value="sections">সেকশন দৃশ্যমানতা</TabsTrigger>
        </TabsList>

        <TabsContent value="slides" className="mt-4">
          <SlideManager />
        </TabsContent>
        <TabsContent value="sidebanners" className="mt-4">
          <SideBannerManager />
        </TabsContent>
        <TabsContent value="why" className="mt-4">
          <WhyUsManager />
        </TabsContent>
        <TabsContent value="testimonials" className="mt-4">
          <TestimonialsManager />
        </TabsContent>
        <TabsContent value="announce" className="mt-4">
          <AnnouncementPopupManager />
        </TabsContent>
        <TabsContent value="sections" className="mt-4">
          <SectionVisibilityManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

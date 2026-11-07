'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Layers, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { toBn, type Category } from '@/lib/types';
import { db, uid } from '@/lib/db/core';
import { categoryTree, logAudit } from '@/lib/db/services';
import { useCollection } from '@/lib/db/hooks';
import { getCurrentUser } from '@/lib/db/auth';
import { BiIcon, CATEGORY_ICON_PICKER, resolveCategoryIcon } from '@/lib/icons';
import { ImageUploadField, useMounted } from './admin-ui';
import { cn } from '@/lib/utils';

const ICON_CHOICES = CATEGORY_ICON_PICKER;

/** বাংলা → ল্যাটিন রূপান্তর (স্লাগ তৈরির জন্য) */
const BN_TO_LATIN: Record<string, string> = {
  'অ': 'a', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi',
  'ও': 'o', 'ঔ': 'ou', 'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng', 'চ': 'ch',
  'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n', 'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh',
  'ণ': 'n', 'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n', 'প': 'p', 'ফ': 'ph',
  'ব': 'b', 'ভ': 'bh', 'ম': 'm', 'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh',
  'স': 's', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h',
  'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi',
  'ো': 'o', 'ৌ': 'ou', '্': '', '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9', '।': '',
};

function transliterate(text: string): string {
  let out = '';
  for (const ch of text) out += BN_TO_LATIN[ch] ?? ch;
  return out;
}

function baseSlug(text: string): string {
  const latin = transliterate(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return latin || 'category';
}

type CatForm = {
  name: string;
  nameBn: string;
  icon: string;
  image: string;
  color: string;
  description: string;
  featured: boolean;
  active: boolean;
  sortOrder: string;
  parentId: string;
  seoTitle: string;
  seoDescription: string;
};

const EMPTY_FORM: CatForm = {
  name: '', nameBn: '', icon: 'bi-basket', image: '', color: '', description: '',
  featured: false, active: true, sortOrder: '0', parentId: '', seoTitle: '', seoDescription: '',
};

export function AdminCategories() {
  const { toast } = useToast();
  const categories = useCollection('categories');
  const products = useCollection('products');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CatForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const mounted = useMounted();

  const tree = useMemo(() => categoryTree(), [categories]);
  const productCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.categoryId, (m.get(p.categoryId) || 0) + 1);
    return m;
  }, [products]);

  // স্লাগ প্রিভিউ (নতুন ক্যাটাগরির ক্ষেত্রে)
  const slugPreview = useMemo(() => {
    const src = form.nameBn.trim() || form.name.trim();
    if (!src) return '—';
    let s = baseSlug(src);
    let i = 2;
    while (categories.some((c) => c.slug === s && c.id !== editing?.id)) {
      s = `${baseSlug(src)}-${i++}`;
    }
    return s;
  }, [form.name, form.nameBn, categories, editing]);

  const parents = categories.filter((c) => !c.parentId);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({
      name: c.name,
      nameBn: c.nameBn || '',
      icon: resolveCategoryIcon(c.icon),
      image: c.image || '',
      color: c.color || '',
      description: c.description || '',
      featured: !!c.featured,
      active: c.active ?? true,
      sortOrder: String(c.sortOrder ?? 0),
      parentId: c.parentId || '',
      seoTitle: c.seoTitle || '',
      seoDescription: c.seoDescription || '',
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.name.trim() && !form.nameBn.trim()) {
      toast({ title: 'নাম লিখুন', description: 'বাংলা বা ইংরেজি — যেকোনো একটি নাম আবশ্যক', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const nameVal = form.name.trim() || form.nameBn.trim();
      // স্লাগ ইউনিক চেক (এডিটে পুরোনো স্লাগ রাখা হয়)
      let slug: string;
      if (editing) {
        slug = editing.slug;
      } else {
        slug = baseSlug(form.nameBn.trim() || nameVal);
        let i = 2;
        while (categories.some((c) => c.slug === slug)) slug = `${baseSlug(form.nameBn.trim() || nameVal)}-${i++}`;
      }
      const cat: Category = {
        id: editing?.id || uid('cat_'),
        name: nameVal,
        nameBn: form.nameBn.trim() || null,
        slug,
        icon: form.icon,
        image: form.image || null,
        description: form.description.trim() || null,
        color: form.color || null,
        featured: form.featured,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
        parentId: form.parentId || null,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
      };
      if (editing) {
        db.put('categories', cat);
        logAudit({ actor: getCurrentUser()?.email || 'admin', action: 'category.update', entity: 'category', entityId: cat.slug, details: cat.nameBn || cat.name });
      } else {
        db.append('categories', cat);
        logAudit({ actor: getCurrentUser()?.email || 'admin', action: 'category.create', entity: 'category', entityId: cat.slug, details: cat.nameBn || cat.name });
      }
      toast({ title: editing ? 'ক্যাটাগরি আপডেট হয়েছে' : 'ক্যাটাগরি তৈরি হয়েছে' });
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const hasProducts = products.some((p) => p.categoryId === deleteTarget.id);
    const hasChildren = categories.some((c) => c.parentId === deleteTarget.id);
    if (hasProducts) {
      toast({ title: 'মুছা যাবে না', description: 'এই ক্যাটাগরিতে পণ্য আছে — আগে পণ্যগুলো সরান', variant: 'destructive' });
      setDeleteTarget(null);
      return;
    }
    if (hasChildren) {
      toast({ title: 'মুছা যাবে না', description: 'এই ক্যাটাগরির সাব-ক্যাটাগরি আছে — আগে সেগুলো মুছুন বা সরান', variant: 'destructive' });
      setDeleteTarget(null);
      return;
    }
    db.remove('categories', deleteTarget.id);
    logAudit({ actor: getCurrentUser()?.email || 'admin', action: 'category.delete', entity: 'category', entityId: deleteTarget.slug, details: deleteTarget.nameBn || deleteTarget.name });
    toast({ title: 'ক্যাটাগরি মুছে ফেলা হয়েছে' });
    setDeleteTarget(null);
  };

  const toggleFeatured = (c: Category) => {
    db.put('categories', { ...c, featured: !c.featured });
  };

  const toggleActive = (c: Category) => {
    db.put('categories', { ...c, active: !(c.active ?? true) });
  };

  const renderRow = (c: Category, isChild = false) => {
    const count = productCount.get(c.id) || 0;
    return (
      <div
        key={c.id}
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3',
          isChild && 'ml-4 border-dashed sm:ml-8',
          !(c.active ?? true) && 'opacity-60'
        )}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={c.color ? { backgroundColor: `${c.color}22`, color: c.color } : { backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
        >
          {c.image ? (
            <img src={c.image} alt={c.nameBn || c.name} className="h-full w-full object-cover" />
          ) : (
            <BiIcon name={resolveCategoryIcon(c.icon)} className="text-lg" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{c.nameBn || c.name}</span>
            {c.nameBn && c.name && c.name !== c.nameBn && (
              <span className="text-[10px] text-muted-foreground">({c.name})</span>
            )}
            {c.featured && <Badge className="bg-primary/10 text-[10px] text-primary hover:bg-primary/10">ফিচার্ড</Badge>}
            {!(c.active ?? true) && <Badge variant="destructive" className="text-[10px]">নিষ্ক্রিয়</Badge>}
            <span className="text-[10px] text-muted-foreground">/{c.slug}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {toBn(count)} টি পণ্য • ক্রম: {toBn(c.sortOrder ?? 0)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="mr-1 hidden items-center gap-1.5 sm:flex">
            <span className="text-[10px] text-muted-foreground">সক্রিয়</span>
            <Switch checked={c.active ?? true} onCheckedChange={() => toggleActive(c)} aria-label="সক্রিয় টগল" />
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => toggleFeatured(c)} aria-label="ফিচার্ড টগল">
            <Star className={cn('h-3.5 w-3.5', c.featured && 'fill-amber-400 text-amber-400')} />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label="সম্পাদনা">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(c)} aria-label="মুছুন">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">ক্যাটাগরি ম্যানেজমেন্ট</h2>
        <Button onClick={openCreate} className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন ক্যাটাগরি
        </Button>
      </div>

      {!mounted ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <Layers className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো ক্যাটাগরি নেই — নতুন একটি তৈরি করুন</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tree.map((p) => (
            <div key={p.id}>
              {renderRow(p)}
              {p.children.map((sc) => renderRow(sc, true))}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'ক্যাটাগরি সম্পাদনা' : 'নতুন ক্যাটাগরি'}</DialogTitle>
            <DialogDescription>আইকন, ছবি ও SEO তথ্যসহ ক্যাটাগরি তৈরি করুন</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <ImageUploadField
              label="ক্যাটাগরি ইমেজ"
              hint="হোমপেজের ক্যাটাগরি কার্ডে দেখানো হবে (খালি রাখলে আইকন দেখানো হবে)"
              folder="categories"
              aspect="square"
              value={form.image}
              onChange={(url) => setForm({ ...form, image: url })}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>বাংলা নাম</Label>
                <Input value={form.nameBn} onChange={(e) => setForm({ ...form, nameBn: e.target.value })} placeholder="যেমন: মধু" className="mt-1.5" />
              </div>
              <div>
                <Label>ইংরেজি নাম</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Honey" className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label>স্লাগ (স্বয়ংক্রিয়)</Label>
              <Input value={editing ? editing.slug : slugPreview} readOnly disabled className="mt-1.5 font-mono text-xs" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                নাম থেকে স্বয়ংক্রিয়ভাবে তৈরি হয় — ইউনিক রাখতে প্রয়োজনে সংখ্যা যোগ হয়
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>প্যারেন্ট ক্যাটাগরি</Label>
                <Select value={form.parentId || 'none'} onValueChange={(v) => setForm({ ...form, parentId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">নেই (মূল ক্যাটাগরি)</SelectItem>
                    {parents.filter((p) => p.id !== editing?.id).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nameBn || p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>সর্ট অর্ডার</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label>আইকন</Label>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5 rounded-lg border bg-muted/30 p-2 sm:grid-cols-9">
                {ICON_CHOICES.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm({ ...form, icon })}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-base transition-all',
                      form.icon === icon ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-accent'
                    )}
                    aria-label={`আইকন ${icon}`}
                  >
                    <BiIcon name={icon} />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 items-end gap-4">
              <div>
                <Label>কালার (ঐচ্ছিক)</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color || '#22c55e'}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
                    aria-label="ক্যাটাগরি কালার"
                  />
                  <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#22c55e" className="font-mono text-xs" />
                  {form.color && (
                    <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, color: '' })}>মুছুন</Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>বিবরণ</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ক্যাটাগরির সংক্ষিপ্ত পরিচয়" className="mt-1.5" />
            </div>

            <div className="grid gap-4 rounded-lg border bg-muted/30 p-3">
              <div>
                <Label>SEO টাইটেল</Label>
                <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} placeholder="সার্চ ইঞ্জিনের জন্য টাইটেল" className="mt-1.5" />
              </div>
              <div>
                <Label>SEO বিবরণ</Label>
                <Textarea rows={2} value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} placeholder="মেটা ডেসক্রিপশন" className="mt-1.5" />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
                হোমপেজে ফিচার্ড হিসেবে দেখান
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                সক্রিয়
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> সেভ হচ্ছে...</> : editing ? 'আপডেট করুন' : 'তৈরি করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ক্যাটাগরিটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.nameBn || deleteTarget?.name}&quot; স্থায়ীভাবে মুছে যাবে। ক্যাটাগরিতে পণ্য বা সাব-ক্যাটাগরি থাকলে মুছা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">হ্যাঁ, মুছুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

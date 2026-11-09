'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Store, Search, Star } from 'lucide-react';
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { toBn, type Brand } from '@/lib/types';
import { db, uid } from '@/lib/db/core';
import { useCollection } from '@/lib/db/hooks';
import { getCurrentUser } from '@/lib/db/auth';
import { logAudit } from '@/lib/db/services';
import { ImageUploadField, useMounted } from './admin-ui';
import { cn } from '@/lib/utils';

type BrandForm = {
  name: string;
  logo: string;
  description: string;
  featured: boolean;
  active: boolean;
  sortOrder: string;
};

const EMPTY_FORM: BrandForm = { name: '', logo: '', description: '', featured: false, active: true, sortOrder: '0' };

function baseSlug(text: string): string {
  const latin = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return latin || `brand-${Math.random().toString(36).slice(2, 6)}`;
}

export function AdminBrands() {
  const { toast } = useToast();
  const brands = useCollection('brands');
  const products = useCollection('products');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<BrandForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);

  const mounted = useMounted();

  const productCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      if (p.brandId) m.set(p.brandId, (m.get(p.brandId) || 0) + 1);
    }
    return m;
  }, [products]);

  const filtered = useMemo(
    () =>
      [...brands]
        .filter((b) => !search.trim() || b.name.toLowerCase().includes(search.trim().toLowerCase()) || b.slug.includes(search.trim().toLowerCase()))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [brands, search]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (b: Brand) => {
    setEditing(b);
    setForm({
      name: b.name,
      logo: b.logo || '',
      description: b.description || '',
      featured: !!b.featured,
      active: b.active ?? true,
      sortOrder: String(b.sortOrder ?? 0),
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast({ title: 'ব্র্যান্ডের নাম লিখুন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let slug: string;
      if (editing) {
        slug = editing.slug;
      } else {
        slug = baseSlug(form.name.trim());
        let i = 2;
        while (brands.some((b) => b.slug === slug)) slug = `${baseSlug(form.name.trim())}-${i++}`;
      }
      const brand: Brand = {
        id: editing?.id || uid('brand_'),
        name: form.name.trim(),
        slug,
        logo: form.logo || null,
        description: form.description.trim() || null,
        featured: form.featured,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        db.put('brands', brand);
        logAudit({ actor: getCurrentUser()?.email || 'admin', action: 'brand.update', entity: 'brand', entityId: brand.slug, details: brand.name });
      } else {
        db.append('brands', brand);
        logAudit({ actor: getCurrentUser()?.email || 'admin', action: 'brand.create', entity: 'brand', entityId: brand.slug, details: brand.name });
      }
      toast({ title: editing ? 'ব্র্যান্ড আপডেট হয়েছে' : 'ব্র্যান্ড তৈরি হয়েছে' });
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const count = productCount.get(deleteTarget.id) || 0;
    if (count > 0) {
      toast({
        title: 'মুছা যাবে না',
        description: `এই ব্র্যান্ডে ${toBn(count)} টি পণ্য অ্যাসাইন করা আছে — আগে সেগুলো সরান`,
        variant: 'destructive',
      });
      setDeleteTarget(null);
      return;
    }
    db.remove('brands', deleteTarget.id);
    logAudit({ actor: getCurrentUser()?.email || 'admin', action: 'brand.delete', entity: 'brand', entityId: deleteTarget.slug, details: deleteTarget.name });
    toast({ title: 'ব্র্যান্ড মুছে ফেলা হয়েছে' });
    setDeleteTarget(null);
  };

  const toggleActive = (b: Brand) => {
    db.put('brands', { ...b, active: !(b.active ?? true) });
  };

  const toggleFeatured = (b: Brand) => {
    db.put('brands', { ...b, featured: !b.featured });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">ব্র্যান্ড ম্যানেজমেন্ট</h2>
        <Button onClick={openCreate} className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন ব্র্যান্ড
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ব্র্যান্ড খুঁজুন..."
          className="pl-9"
        />
      </div>

      {!mounted ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <Store className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো ব্র্যান্ড পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((b) => (
            <div
              key={b.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3',
                !(b.active ?? true) && 'opacity-60',
                b.featured && 'border-primary/50 bg-primary/5'
              )}
            >
              <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-0.5">
                {b.logo ? (
                  <img src={b.logo} alt={b.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm font-extrabold text-primary">{b.name[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{b.name}</span>
                  {b.featured && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                </div>
                <div className="text-xs text-muted-foreground">{b.slug}</div>
              </div>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {toBn(productCount.get(b.id) || 0)} পণ্য
              </Badge>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant={b.featured ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleFeatured(b)}
                  aria-label="হোমপেজে হাইলাইট টগল"
                >
                  <Star className={cn('h-3.5 w-3.5', b.featured && 'fill-amber-400 text-amber-400')} />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(b)} aria-label="সম্পাদনা">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(b)} aria-label="মুছুন">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <div className="ml-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">সক্রিয়</span>
                  <Switch checked={b.active ?? true} onCheckedChange={() => toggleActive(b)} aria-label="সক্রিয় টগল" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'ব্র্যান্ড সম্পাদনা' : 'নতুন ব্র্যান্ড যোগ করুন'}</DialogTitle>
            <DialogDescription>
              {editing ? `"${editing.name}" এর তথ্য পরিবর্তন করুন` : 'ব্র্যান্ডের নাম লিখুন — স্লাগ স্বয়ংক্রিয়ভাবে তৈরি হবে'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>ব্র্যান্ডের নাম <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="যেমন: Samsung, Aarong, Bata"
                className="mt-1.5"
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            </div>
            <div>
              <Label>স্লাগ (স্বয়ংক্রিয়)</Label>
              <Input value={editing ? editing.slug : (form.name ? baseSlug(form.name) : '—')} readOnly disabled className="mt-1.5 font-mono text-xs" />
            </div>
            <ImageUploadField
              label="ব্র্যান্ড লোগো"
              hint="হোমপেজের জনপ্রিয় ব্র্যান্ড সেকশনে নামের বদলে লোগো দেখানো হবে"
              folder="brands"
              aspect="logo"
              value={form.logo}
              onChange={(url) => setForm({ ...form, logo: url })}
            />
            <div>
              <Label>বিবরণ</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ব্র্যান্ড সম্পর্কে সংক্ষিপ্ত তথ্য" className="mt-1.5" />
            </div>
            <div>
              <Label>সর্ট অর্ডার</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1.5" />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
                হোমপেজে ফিচার্ড
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ব্র্যান্ডটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; স্থায়ীভাবে মুছে যাবে। ব্র্যান্ডে পণ্য অ্যাসাইন করা থাকলে মুছা যাবে না।
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

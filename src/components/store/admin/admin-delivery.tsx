'use client';

import { useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, MapPin, Truck, Boxes, Search,
  PackagePlus, PackageMinus, AlertTriangle, ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useToast } from '@/hooks/use-toast';
import { db, uid } from '@/lib/db/core';
import { useCollection } from '@/lib/db/hooks';
import { adjustStock } from '@/lib/db/services';
import type { DeliveryZone, Courier, Product, StockMovement } from '@/lib/db/types';
import { formatBDT, toBn, formatBnDate } from '@/lib/types';
import { cn } from '@/lib/utils';

// ───────────────────────────── জোন ─────────────────────────────

const EMPTY_ZONE = {
  name: '',
  districtsText: '',
  charge: '60',
  eta: '',
  freeShippingOver: '0',
  codAvailable: true,
  active: true,
  sortOrder: '0',
};

function ZonesTab() {
  const { toast } = useToast();
  const zones = useCollection('deliveryZones');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState(EMPTY_ZONE);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryZone | null>(null);

  const sorted = [...zones].sort((a, b) => a.sortOrder - b.sortOrder);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_ZONE, sortOrder: String(sorted.length + 1) });
    setDialogOpen(true);
  };

  const openEdit = (z: DeliveryZone) => {
    setEditing(z);
    setForm({
      name: z.name,
      districtsText: (Array.isArray(z.districts) ? z.districts : []).join('\n'),
      charge: String(z.charge),
      eta: z.eta,
      freeShippingOver: z.freeShippingOver ? String(z.freeShippingOver) : '0',
      codAvailable: z.codAvailable,
      active: z.active,
      sortOrder: String(z.sortOrder),
    });
    setDialogOpen(true);
  };

  const save = () => {
    const districts = form.districtsText.split('\n').map((d) => d.trim()).filter(Boolean);
    if (!form.name.trim()) {
      toast({ title: 'জোনের নাম লিখুন', variant: 'destructive' });
      return;
    }
    if (districts.length === 0) {
      toast({ title: 'অন্তত একটি জেলা দিন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const free = Number(form.freeShippingOver) || 0;
      const zone: DeliveryZone = {
        id: editing?.id || uid('zone_'),
        name: form.name.trim(),
        districts,
        charge: Number(form.charge) || 0,
        eta: form.eta.trim() || '২৪-৭২ ঘণ্টা',
        freeShippingOver: free > 0 ? free : null,
        codAvailable: form.codAvailable,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) db.put('deliveryZones', zone);
      else db.append('deliveryZones', zone);
      toast({ title: editing ? 'জোন আপডেট হয়েছে' : 'নতুন জোন যোগ হয়েছে' });
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (z: DeliveryZone) => db.put('deliveryZones', { ...z, active: !z.active });

  const confirmDelete = () => {
    if (!deleteTarget) return;
    db.remove('deliveryZones', deleteTarget.id);
    toast({ title: 'জোন মুছে ফেলা হয়েছে' });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">চেকআউটে ডেলিভারি চার্জ এই জোন অনুযায়ী হিসাব হয়</p>
        <Button onClick={openCreate} size="sm" className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন জোন
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <MapPin className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো ডেলিভারি জোন নেই — ঢাকা, ঢাকার বাইরে যোগ করুন</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {sorted.map((z) => (
            <div key={z.id} className={cn('rounded-xl border bg-card p-3', !z.active && 'opacity-60')}>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold">{z.name}</span>
                    {z.codAvailable && <Badge variant="secondary" className="text-[10px]">COD</Badge>}
                    {!z.active && <Badge className="bg-red-100 text-red-800 text-[10px] dark:bg-red-950 dark:text-red-300">বন্ধ</Badge>}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{(Array.isArray(z.districts) ? z.districts : []).join(', ')}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-primary">{formatBDT(z.charge)}</span>
                    <span className="text-muted-foreground">⏱ {z.eta}</span>
                    {z.freeShippingOver ? <span className="text-muted-foreground">{formatBDT(z.freeShippingOver)}+ ফ্রি</span> : null}
                    <span className="text-muted-foreground">ক্রম: {toBn(z.sortOrder)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={z.active} onCheckedChange={() => toggleActive(z)} aria-label="জোন চালু/বন্ধ" />
                  সক্রিয়
                </label>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(z)} aria-label="সম্পাদনা">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(z)} aria-label="মুছুন">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'ডেলিভারি জোন সম্পাদনা' : 'নতুন ডেলিভারি জোন'}</DialogTitle>
            <DialogDescription>জেলার তালিকা প্রতি লাইনে একটি করে লিখুন</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>জোনের নাম <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ঢাকা সিটি" className="mt-1.5" />
              </div>
              <div>
                <Label>সর্ট অর্ডার</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>জেলাসমূহ (প্রতি লাইনে একটি) <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.districtsText}
                onChange={(e) => setForm({ ...form, districtsText: e.target.value })}
                rows={5}
                placeholder={'ঢাকা\nগাজীপুর\nনারায়ণগঞ্জ'}
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ডেলিভারি চার্জ (৳)</Label>
                <Input type="number" value={form.charge} onChange={(e) => setForm({ ...form, charge: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>সময়সীমা (ETA)</Label>
                <Input value={form.eta} onChange={(e) => setForm({ ...form, eta: e.target.value })} placeholder="২৪-৪৮ ঘণ্টা" className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>ফ্রি শিপিং সীমা (৳) — ০ মানে নেই</Label>
              <Input type="number" value={form.freeShippingOver} onChange={(e) => setForm({ ...form, freeShippingOver: e.target.value })} placeholder="2000" className="mt-1.5" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={form.codAvailable} onCheckedChange={(v) => setForm({ ...form, codAvailable: v })} aria-label="ক্যাশ অন ডেলিভারি চালু/বন্ধ" />
              ক্যাশ অন ডেলিভারি (COD) চালু
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} aria-label="জোন সক্রিয় টগল" />
              জোনটি সক্রিয়
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>জোনটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; স্থায়ীভাবে মুছে যাবে।
              {sorted.length <= 1 && (
                <span className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-100 p-2 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> এটি শেষ জোন — মুছলে ডেলিভারি চার্জ হিসাব বন্ধ হয়ে যাবে!
                </span>
              )}
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

// ───────────────────────────── কুরিয়ার ─────────────────────────────

const EMPTY_COURIER = {
  name: '',
  nameBn: '',
  trackingUrl: '',
  apiKey: '',
  apiSecret: '',
  active: true,
  sortOrder: '0',
};

function CouriersTab() {
  const { toast } = useToast();
  const couriers = useCollection('couriers');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [form, setForm] = useState(EMPTY_COURIER);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Courier | null>(null);

  const sorted = [...couriers].sort((a, b) => a.sortOrder - b.sortOrder);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_COURIER, sortOrder: String(sorted.length + 1) });
    setDialogOpen(true);
  };

  const openEdit = (c: Courier) => {
    setEditing(c);
    setForm({
      name: c.name,
      nameBn: c.nameBn,
      trackingUrl: c.trackingUrl || '',
      apiKey: c.apiKey || '',
      apiSecret: c.apiSecret || '',
      active: c.active,
      sortOrder: String(c.sortOrder),
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.nameBn.trim()) {
      toast({ title: 'কুরিয়ারের নাম (ইংরেজি ও বাংলা) দিন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const courier: Courier = {
        id: editing?.id || uid('courier_'),
        name: form.name.trim(),
        nameBn: form.nameBn.trim(),
        trackingUrl: form.trackingUrl.trim() || null,
        apiKey: form.apiKey.trim() || null,
        apiSecret: form.apiSecret.trim() || null,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) db.put('couriers', courier);
      else db.append('couriers', courier);
      toast({ title: editing ? 'কুরিয়ার আপডেট হয়েছে' : 'নতুন কুরিয়ার যোগ হয়েছে' });
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    db.remove('couriers', deleteTarget.id);
    toast({ title: 'কুরিয়ার মুছে ফেলা হয়েছে' });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">অর্ডার শিপ করার সময় কুরিয়ার নির্বাচন করা যাবে</p>
        <Button onClick={openCreate} size="sm" className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন কুরিয়ার
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <Truck className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো কুরিয়ার নেই — স্টেডফাস্ট, পাঠাও যোগ করুন</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {sorted.map((c) => (
            <div key={c.id} className={cn('rounded-xl border bg-card p-3', !c.active && 'opacity-60')}>
              <div className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold">{c.nameBn}</span>
                    <span className="text-xs text-muted-foreground">({c.name})</span>
                    {!c.active && <Badge className="bg-red-100 text-red-800 text-[10px] dark:bg-red-950 dark:text-red-300">বন্ধ</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.trackingUrl ? `ট্র্যাকিং: ${c.trackingUrl}` : 'ট্র্যাকিং URL নেই'} • ক্রম: {toBn(c.sortOrder)}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label="সম্পাদনা">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(c)} aria-label="মুছুন">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Courier dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'কুরিয়ার সম্পাদনা' : 'নতুন কুরিয়ার'}</DialogTitle>
            <DialogDescription>ট্র্যাকিং URL-এ {'{tracking}'} প্লেসহোল্ডার ব্যবহার করুন</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>নাম (ইংরেজি) <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Steadfast" className="mt-1.5" />
              </div>
              <div>
                <Label>নাম (বাংলা) <span className="text-destructive">*</span></Label>
                <Input value={form.nameBn} onChange={(e) => setForm({ ...form, nameBn: e.target.value })} placeholder="স্টেডফাস্ট" className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>ট্র্যাকিং URL (ঐচ্ছিক)</Label>
              <Input value={form.trackingUrl} onChange={(e) => setForm({ ...form, trackingUrl: e.target.value })} placeholder="https://steadfast.com.bd/t/{tracking}" className="mt-1.5" />
              <p className="mt-1 text-[11px] text-muted-foreground">{'{tracking}'} প্লেসহোল্ডার — ট্র্যাকিং নম্বর বসে যাবে</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>API Key (ঐচ্ছিক)</Label>
                <Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>API Secret (ঐচ্ছিক)</Label>
                <Input type="password" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">API Key/Secret ভবিষ্যৎ API ইন্টিগ্রেশনের জন্য সংরক্ষিত</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} aria-label="কুরিয়ার সক্রিয় টগল" />
                কুরিয়ার সক্রিয়
              </label>
              <div>
                <Label>সর্ট অর্ডার</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1.5" />
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>কুরিয়ার মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{deleteTarget?.nameBn || deleteTarget?.name}&quot; স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
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

// ───────────────────────────── স্টক মুভমেন্ট ─────────────────────────────

const MOVEMENT_TYPE_BN: Record<string, string> = {
  in: 'স্টক ইন',
  out: 'স্টক আউট',
  adjust: 'সমন্বয়',
};

function StockTab() {
  const { toast } = useToast();
  const products = useCollection('products');
  const movements = useCollection('stockMovements');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...movements]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .filter((m) => (typeFilter === 'all' ? true : m.type === typeFilter))
      .filter((m) => {
        if (!q) return true;
        const p = productMap.get(m.productId);
        return (
          m.productName.toLowerCase().includes(q) ||
          (p?.name || '').toLowerCase().includes(q) ||
          (p?.sku || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 80);
  }, [movements, typeFilter, search, productMap]);

  const lowStock = useMemo(() => products.filter((p) => p.stock <= 10).sort((a, b) => a.stock - b.stock), [products]);

  const openAdjust = () => {
    setProductId('');
    setDelta('');
    setNote('');
    setAdjustOpen(true);
  };

  const submitAdjust = () => {
    const d = Number(delta);
    if (!productId) {
      toast({ title: 'পণ্য নির্বাচন করুন', variant: 'destructive' });
      return;
    }
    if (!d || d === 0) {
      toast({ title: 'পরিমাণ দিন (০ ছাড়া)', variant: 'destructive' });
      return;
    }
    adjustStock(productId, Math.round(d), note.trim() || undefined);
    toast({
      title: d > 0 ? 'স্টক যোগ হয়েছে' : 'স্টক কমানো হয়েছে',
      description: `${productMap.get(productId)?.nameBn || productMap.get(productId)?.name || ''} • ${d > 0 ? '+' : '−'}${toBn(Math.abs(d))}`,
    });
    setAdjustOpen(false);
  };

  const typeBadge = (t: string) => {
    if (t === 'in') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    if (t === 'out') return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  };

  const signedQty = (m: StockMovement) => (m.type === 'out' ? `−${toBn(m.quantity)}` : `+${toBn(m.quantity)}`);

  return (
    <div className="space-y-3">
      {/* Quick adjust + low stock */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openAdjust} size="sm" className="gap-1.5 font-semibold">
          <PackagePlus className="h-4 w-4" /> স্টক অ্যাডজাস্ট
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto rounded-xl border bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="shrink-0 text-xs font-semibold text-amber-800 dark:text-amber-300">লো-স্টক ({toBn(lowStock.length)}):</span>
          {lowStock.length === 0 ? (
            <span className="text-xs text-muted-foreground">সব পণ্যে পর্যাপ্ত স্টক আছে</span>
          ) : (
            lowStock.slice(0, 6).map((p) => (
              <Badge key={p.id} variant="outline" className="shrink-0 whitespace-nowrap text-[10px]">
                {(p.nameBn || p.name).slice(0, 16)} • {toBn(p.stock)}
              </Badge>
            ))
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger aria-label="ধরন ফিল্টার"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব ধরন</SelectItem>
            <SelectItem value="in">স্টক ইন (+)</SelectItem>
            <SelectItem value="out">স্টক আউট (−)</SelectItem>
            <SelectItem value="adjust">সমন্বয়</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="পণ্য খুঁজুন..." className="pl-9" />
        </div>
      </div>

      {/* Movement list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <Boxes className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো স্টক মুভমেন্ট নেই</p>
        </div>
      ) : (
        <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
          {filtered.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-xl border bg-card p-3 text-xs">
              <Badge className={cn('shrink-0 text-[10px]', typeBadge(m.type))}>
                {m.type === 'out' ? <PackageMinus className="mr-1 inline h-3 w-3" /> : <PackagePlus className="mr-1 inline h-3 w-3" />}
                {MOVEMENT_TYPE_BN[m.type] || m.type}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{m.productName}</div>
                <div className="truncate text-muted-foreground">
                  {m.note || '—'}{m.ref ? ` • রেফ: ${m.ref}` : ''}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={cn('text-sm font-extrabold', m.type === 'out' ? 'text-red-600' : 'text-emerald-600')}>{signedQty(m)}</div>
                <div className="text-[10px] text-muted-foreground">{formatBnDate(m.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adjust dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>স্টক অ্যাডজাস্ট</DialogTitle>
            <DialogDescription>+ স্টক যোগ করুন অথবা − কমান</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>পণ্য <span className="text-destructive">*</span></Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="পণ্য নির্বাচন করুন" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {[...products].sort((a, b) => (a.nameBn || a.name).localeCompare(b.nameBn || b.name, 'bn')).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nameBn || p.name} (স্টক: {toBn(p.stock)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>পরিমাণ (± ডেল্টা)</Label>
              <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="যেমন: 10 বা -3" className="mt-1.5" />
              <p className="mt-1 text-[11px] text-muted-foreground"><ArrowUpDown className="mr-1 inline h-3 w-3" />+ স্টক যোগ / − কমাও</p>
            </div>
            <div>
              <Label>নোট (ঐচ্ছিক)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন: নতুন চালান এসেছে" className="mt-1.5" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setAdjustOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={submitAdjust}>অ্যাডজাস্ট করুন</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────────────────────── মূল সেকশন ─────────────────────────────

export function AdminDelivery() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">ডেলিভারি ম্যানেজমেন্ট</h2>
        <p className="text-xs text-muted-foreground">জোন, কুরিয়ার ও স্টক মুভমেন্ট পরিচালনা করুন</p>
      </div>
      <Tabs defaultValue="zones" className="gap-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="zones" className="gap-1.5"><MapPin className="h-4 w-4" /> ডেলিভারি জোন</TabsTrigger>
          <TabsTrigger value="couriers" className="gap-1.5"><Truck className="h-4 w-4" /> কুরিয়ার</TabsTrigger>
          <TabsTrigger value="stock" className="gap-1.5"><Boxes className="h-4 w-4" /> স্টক মুভমেন্ট</TabsTrigger>
        </TabsList>
        <TabsContent value="zones"><ZonesTab /></TabsContent>
        <TabsContent value="couriers"><CouriersTab /></TabsContent>
        <TabsContent value="stock"><StockTab /></TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Plus, Pencil, Trash2, Search, Loader2, PackageX, X, Palette, Ruler, Layers,
  ImagePlus, Copy, Download, Upload, MoreVertical, Package, PackageMinus, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatBDT, toBn, buildVariantKey, getProductImages, type Product } from '@/lib/types';
import { db } from '@/lib/db/core';
import { useCollection } from '@/lib/db/hooks';
import {
  categoryTree, saveProduct, deleteProduct, adjustStock, downloadCSV, logAudit,
  type ProductInput,
} from '@/lib/db/services';
import { getCurrentUser } from '@/lib/db/auth';
import { ImageUploadField, useMounted } from './admin-ui';
import { cn } from '@/lib/utils';

type CatLite = { id: string; name: string; nameBn?: string | null };
type BrandLite = { id: string; name: string; slug: string };
type ColorDraft = { name: string; hex?: string };
type VariantDraft = {
  key: string;
  color?: string | null;
  colorHex?: string | null;
  size?: string | null;
  price: string;
  stock: string;
  image?: string | null;
};

type ProductForm = {
  name: string;
  nameBn: string;
  sku: string;
  description: string;
  shortDescription: string;
  price: string;
  comparePrice: string;
  unit: string;
  stock: string;
  categoryId: string;
  brandId: string;
  images: string[];
  colors: ColorDraft[];
  sizes: string[];
  variants: VariantDraft[];
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  isPreOrder: boolean;
  active: boolean;
  weight: string;
  origin: string;
};

const EMPTY_FORM: ProductForm = {
  name: '', nameBn: '', sku: '', description: '', shortDescription: '',
  price: '', comparePrice: '', unit: 'পিস', stock: '50', categoryId: '', brandId: '',
  images: [], colors: [], sizes: [], variants: [],
  isFeatured: false, isNew: true, isBestSeller: false, isPreOrder: false,
  active: true, weight: '', origin: 'Bangladesh',
};

/** ছোট CSV পার্সার (কোটেড ফিল্ড সাপোর্টেড) */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQ = false;
  const pushField = () => { cur.push(field); field = ''; };
  const pushRow = () => {
    pushField();
    if (cur.some((c) => c.trim() !== '')) rows.push(cur);
    cur = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') pushField();
    else if (ch === '\n') pushRow();
    else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      pushRow();
    } else field += ch;
  }
  if (field !== '' || cur.length > 0) pushRow();
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, idx) => [h, (r[idx] ?? '').trim()])));
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

export function AdminProducts({
  initialSearch,
}: { initialSearch?: string; categories?: CatLite[]; brands?: BrandLite[] } = {}) {
  const { toast } = useToast();
  const products = useCollection('products');
  const categoriesAll = useCollection('categories');
  const brandsAll = useCollection('brands');

  // ফিল্টার স্টেট
  const [search, setSearch] = useState(initialSearch ?? '');
  const [fCat, setFCat] = useState('all');
  const [fBrand, setFBrand] = useState('all');
  const [fStock, setFStock] = useState('all');
  const [fBadge, setFBadge] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // বাল্ক সিলেক্ট
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // ডায়ালগ স্টেট
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // ইমেজ ম্যানেজার
  const [imageUrlInput, setImageUrlInput] = useState('');

  // ভ্যারিয়েন্ট এডিটর
  const [colorNameInput, setColorNameInput] = useState('');
  const [sizeInput, setSizeInput] = useState('');

  // স্টক অ্যাডজাস্ট
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState('1');
  const [stockDir, setStockDir] = useState<'in' | 'out'>('in');
  const [stockNote, setStockNote] = useState('');

  // CSV ইমপোর্ট
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const mounted = useMounted();

  const tree = useMemo(() => categoryTree(), [categoriesAll]);
  const flatCats: CatLite[] = useMemo(() => {
    const out: CatLite[] = [];
    for (const root of tree) {
      out.push({ id: root.id, name: root.name, nameBn: root.nameBn });
      for (const ch of root.children) {
        out.push({ id: ch.id, name: ch.name, nameBn: ch.nameBn ? `· ${ch.nameBn}` : ch.name });
      }
    }
    return out;
  }, [tree]);
  const catNameById = useMemo(() => new Map(categoriesAll.map((c) => [c.id, c.nameBn || c.name])), [categoriesAll]);
  const brandById = useMemo(() => new Map(brandsAll.map((b) => [b.id, b])), [brandsAll]);

  // ── ফিল্টারিং ও সর্টিং ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || (p.nameBn || '').includes(search.trim()) || p.sku.toLowerCase().includes(q))) return false;
      if (fCat !== 'all' && p.categoryId !== fCat) return false;
      if (fBrand !== 'all' && (p.brandId || '') !== fBrand) return false;
      if (fStock === 'low' && !(p.stock > 0 && p.stock <= 10)) return false;
      if (fStock === 'out' && p.stock !== 0) return false;
      if (fBadge === 'featured' && !p.isFeatured) return false;
      if (fBadge === 'new' && !p.isNew) return false;
      if (fBadge === 'bestseller' && !p.isBestSeller) return false;
      return true;
    });
    list = [...list];
    if (sortBy === 'name-asc') list.sort((a, b) => (a.nameBn || a.name).localeCompare(b.nameBn || b.name, 'bn'));
    else if (sortBy === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (sortBy === 'stock-asc') list.sort((a, b) => a.stock - b.stock);
    else if (sortBy === 'sold-desc') list.sort((a, b) => b.soldCount - a.soldCount);
    return list;
  }, [products, search, fCat, fBrand, fStock, fBadge, sortBy]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((s) => {
      if (filtered.every((p) => s.has(p.id))) {
        const next = new Set(s);
        for (const p of filtered) next.delete(p.id);
        return next;
      }
      const next = new Set(s);
      for (const p of filtered) next.add(p.id);
      return next;
    });
  };

  // ── ভ্যারিয়েন্ট ম্যাট্রিক্স রিবিল্ড (এডিট সংরক্ষণ করে) ──
  const rebuildVariants = (colors: ColorDraft[], sizes: string[], basePrice: string, baseStock: string) => {
    setForm((f) => {
      const prev = new Map(f.variants.map((v) => [v.key, v]));
      const next: VariantDraft[] = [];
      const colorList = colors.length ? colors : [null];
      const sizeList = sizes.length ? sizes : [null];
      for (const c of colorList) {
        for (const s of sizeList) {
          const key = buildVariantKey(c?.name ?? null, s ?? null);
          const existing = prev.get(key);
          next.push({
            key,
            color: c?.name ?? null,
            colorHex: c?.hex ?? null,
            size: s ?? null,
            price: existing?.price ?? basePrice ?? '',
            stock: existing?.stock ?? baseStock ?? '',
            image: existing?.image ?? null,
          });
        }
      }
      return { ...f, variants: next };
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, categoryId: flatCats[0]?.id || '' });
    setImageUrlInput('');
    setColorNameInput('');
    setSizeInput('');
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    const colors: ColorDraft[] = (() => {
      try {
        const arr: unknown[] = p.colors ? JSON.parse(p.colors) : [];
        if (!Array.isArray(arr)) return [];
        return arr
          .map((c): ColorDraft => {
            if (typeof c === 'string') return { name: c };
            const obj = (c ?? {}) as { name?: unknown; hex?: unknown };
            return { name: String(obj.name || ''), hex: obj.hex ? String(obj.hex) : undefined };
          })
          .filter((c) => c.name);
      } catch { return []; }
    })();
    const sizes: string[] = (() => {
      try {
        const arr = p.sizes ? JSON.parse(p.sizes) : [];
        return Array.isArray(arr) ? arr.map(String) : [];
      } catch { return []; }
    })();
    setForm({
      name: p.name,
      nameBn: p.nameBn || '',
      sku: p.sku,
      description: p.description,
      shortDescription: p.shortDescription || '',
      price: String(p.price),
      comparePrice: p.comparePrice ? String(p.comparePrice) : '',
      unit: p.unit,
      stock: String(p.stock),
      categoryId: p.categoryId,
      brandId: p.brandId || '',
      images: getProductImages(p),
      colors,
      sizes,
      variants: (p.variants || []).map((v) => ({
        key: v.key,
        color: v.color,
        colorHex: v.colorHex,
        size: v.size,
        price: String(v.price),
        stock: String(v.stock),
        image: v.image ?? null,
      })),
      isFeatured: p.isFeatured,
      isNew: p.isNew,
      isBestSeller: p.isBestSeller,
      isPreOrder: p.isPreOrder,
      active: p.active,
      weight: p.weight || '',
      origin: p.origin || '',
    });
    setImageUrlInput('');
    setColorNameInput('');
    setSizeInput('');
    setDialogOpen(true);
  };

  // ── ইমেজ ম্যানেজার ──
  const addImage = (url: string) => {
    const u = url.trim();
    if (!u) return;
    setForm((f) => (f.images.includes(u) ? f : { ...f, images: [...f.images, u] }));
  };

  const removeImage = (idx: number) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const setPrimaryImage = (idx: number) => {
    setForm((f) => {
      const imgs = [...f.images];
      const [img] = imgs.splice(idx, 1);
      return { ...f, images: [img, ...imgs] };
    });
  };

  // ── কালার এডিটর ──
  const addColor = () => {
    const nm = colorNameInput.trim();
    if (!nm) return;
    if (form.colors.some((c) => c.name === nm)) {
      toast({ title: 'এই রং আগে থেকেই আছে', variant: 'destructive' });
      return;
    }
    const nextColors = [...form.colors, { name: nm }];
    setForm((f) => ({ ...f, colors: nextColors }));
    setColorNameInput('');
    rebuildVariants(nextColors, form.sizes, form.price, form.stock);
  };

  const removeColor = (nm: string) => {
    const nextColors = form.colors.filter((c) => c.name !== nm);
    setForm((f) => ({ ...f, colors: nextColors }));
    rebuildVariants(nextColors, form.sizes, form.price, form.stock);
  };

  const updateColorName = (oldName: string, newName: string) => {
    const nm = newName.trim();
    // ডুপ্লিকেট নাম হলে ভ্যারিয়েন্ট কী-কলিশন তৈরি হয় — আগেই থাকলে ব্লক
    if (nm && nm !== oldName && form.colors.some((c) => c.name === nm)) return;
    setForm((f) => ({
      ...f,
      colors: f.colors.map((c) => (c.name === oldName ? { ...c, name: nm } : c)),
      variants: f.variants.map((v) => (v.color === oldName ? { ...v, color: nm, key: buildVariantKey(nm, v.size) } : v)),
    }));
  };

  const updateColorHex = (nm: string, hex: string) => {
    setForm((f) => ({
      ...f,
      colors: f.colors.map((c) => (c.name === nm ? { ...c, hex } : c)),
      variants: f.variants.map((v) => (v.color === nm ? { ...v, colorHex: hex } : v)),
    }));
  };

  // ── সাইজ এডিটর ──
  const addSize = () => {
    const sz = sizeInput.trim();
    if (!sz) return;
    if (form.sizes.includes(sz)) {
      toast({ title: 'এই সাইজ আগে থেকেই আছে', variant: 'destructive' });
      return;
    }
    const nextSizes = [...form.sizes, sz];
    setForm((f) => ({ ...f, sizes: nextSizes }));
    setSizeInput('');
    rebuildVariants(form.colors, nextSizes, form.price, form.stock);
  };

  const removeSize = (sz: string) => {
    const nextSizes = form.sizes.filter((s) => s !== sz);
    setForm((f) => ({ ...f, sizes: nextSizes }));
    rebuildVariants(form.colors, nextSizes, form.price, form.stock);
  };

  const updateVariant = (key: string, field: 'price' | 'stock', value: string) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => (v.key === key ? { ...v, [field]: value } : v)),
    }));
  };

  const setVariantImage = (key: string, image: string | null) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => (v.key === key ? { ...v, image } : v)),
    }));
  };

  const hasVariantSection = form.colors.length > 0 || form.sizes.length > 0;
  const totalVariantStock = useMemo(
    () => form.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0),
    [form.variants]
  );
  const slugHint = form.nameBn.trim() || form.name.trim()
    ? (editing ? editing.slug : `${(form.nameBn.trim() || form.name.trim()).toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').replace(/^-+|-+$/g, '') || 'product'}-…`)
    : '—';

  // ── সেভ ──
  const save = () => {
    if (!form.name.trim() && !form.nameBn.trim()) return toast({ title: 'পণ্যের নাম লিখুন', variant: 'destructive' });
    if (!form.price || Number(form.price) <= 0) return toast({ title: 'সঠিক দাম দিন', variant: 'destructive' });
    if (!form.categoryId) return toast({ title: 'ক্যাটাগরি নির্বাচন করুন', variant: 'destructive' });
    if (hasVariantSection && form.variants.length === 0) {
      return toast({ title: 'অন্তত একটি রং বা সাইজ যোগ করুন', variant: 'destructive' });
    }

    setSaving(true);
    try {
      const input: ProductInput = {
        id: editing?.id,
        name: form.name.trim() || form.nameBn.trim(),
        nameBn: form.nameBn.trim() || null,
        sku: form.sku.trim() || undefined,
        description: form.description.trim(),
        shortDescription: form.shortDescription.trim() || null,
        price: Number(form.price),
        comparePrice: form.comparePrice ? Number(form.comparePrice) : null,
        unit: form.unit.trim() || 'পিস',
        stock: hasVariantSection ? totalVariantStock : Number(form.stock) || 0,
        categoryId: form.categoryId,
        brandId: form.brandId || null,
        images: JSON.stringify(form.images),
        colors: form.colors.length ? JSON.stringify(form.colors.map((c) => (c.hex ? { name: c.name, hex: c.hex } : { name: c.name }))) : null,
        sizes: form.sizes.length ? JSON.stringify(form.sizes) : null,
        variants: hasVariantSection
          ? form.variants.map((v) => ({
              key: v.key,
              color: v.color ?? null,
              colorHex: v.colorHex ?? null,
              size: v.size ?? null,
              price: Number(v.price) || Number(form.price) || 0,
              stock: Number(v.stock) || 0,
              image: v.image || null,
            }))
          : [],
        isFeatured: form.isFeatured,
        isNew: form.isNew,
        isBestSeller: form.isBestSeller,
        isPreOrder: form.isPreOrder,
        active: form.active,
        weight: form.weight.trim() || null,
        origin: form.origin.trim() || null,
      };
      const res = saveProduct(input);
      if (res.ok) {
        toast({ title: editing ? 'পণ্য আপডেট হয়েছে' : 'পণ্য তৈরি হয়েছে' });
        setDialogOpen(false);
      } else {
        toast({ title: 'সমস্যা হয়েছে', description: res.error, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  // ── ডিলিট ──
  const confirmDelete = () => {
    if (!deleteTarget) return;
    const res = deleteProduct(deleteTarget.id);
    if (res.ok) toast({ title: 'পণ্য মুছে ফেলা হয়েছে' });
    else toast({ title: 'মুছতে ব্যর্থ', description: res.error, variant: 'destructive' });
    setSelected((s) => {
      const next = new Set(s);
      next.delete(deleteTarget.id);
      return next;
    });
    setDeleteTarget(null);
  };

  // ── ডুপ্লিকেট ──
  const duplicate = (p: Product) => {
    const res = saveProduct({
      ...p,
      id: undefined,
      slug: undefined,
      name: `${p.name} (কপি)`,
      nameBn: p.nameBn ? `${p.nameBn} (কপি)` : null,
      active: false,
    });
    if (res.ok) toast({ title: 'কপি তৈরি হয়েছে', description: `${p.nameBn || p.name} (কপি) — নিষ্ক্রিয় অবস্থায় সংরক্ষিত` });
    else toast({ title: 'কপি করা যায়নি', description: res.error, variant: 'destructive' });
  };

  // ── স্টক অ্যাডজাস্ট ──
  const applyStockAdjust = () => {
    if (!stockTarget) return;
    const qty = Math.abs(Number(stockQty) || 0);
    if (!qty) return toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
    adjustStock(stockTarget.id, stockDir === 'in' ? qty : -qty, stockNote.trim() || undefined);
    logAudit({
      actor: getCurrentUser()?.email || 'admin',
      action: 'product.stock_adjust',
      entity: 'product',
      entityId: stockTarget.slug,
      details: `${stockDir === 'in' ? '+' : '−'}${qty} — ${stockTarget.nameBn || stockTarget.name}`,
    });
    toast({ title: 'স্টক আপডেট হয়েছে', description: `${stockTarget.nameBn || stockTarget.name}: ${stockDir === 'in' ? '+' : '−'}${toBn(qty)}` });
    setStockTarget(null);
    setStockQty('1');
    setStockNote('');
    setStockDir('in');
  };

  const toggleActive = (p: Product) => {
    db.put('products', { ...p, active: !p.active });
    logAudit({
      actor: getCurrentUser()?.email || 'admin',
      action: 'product.toggle_active',
      entity: 'product',
      entityId: p.slug,
      details: `${p.nameBn || p.name} → ${!p.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}`,
    });
    toast({
      title: !p.active ? 'পণ্য প্রকাশিত হয়েছে' : 'পণ্য অপ্রকাশিত হয়েছে',
      description: p.nameBn || p.name,
    });
  };

  // ── CSV এক্সপোর্ট ──
  const exportCsv = () => {
    if (filtered.length === 0) {
      toast({ title: 'এক্সপোর্ট করার মতো পণ্য নেই', variant: 'destructive' });
      return;
    }
    const rows = filtered.map((p) => ({
      name: p.name,
      nameBn: p.nameBn || '',
      sku: p.sku,
      category: categoriesAll.find((c) => c.id === p.categoryId)?.slug || '',
      brand: p.brandId ? brandsAll.find((b) => b.id === p.brandId)?.slug || '' : '',
      price: p.price,
      comparePrice: p.comparePrice ?? '',
      stock: p.stock,
      unit: p.unit,
      description: p.description,
      images: getProductImages(p).join(';'),
    }));
    downloadCSV('the-shop-bd-products.csv', rows, {
      name: 'নাম',
      nameBn: 'বাংলা নাম',
      sku: 'SKU',
      category: 'ক্যাটাগরি স্লাগ',
      brand: 'ব্র্যান্ড স্লাগ',
      price: 'দাম',
      comparePrice: 'আগের দাম',
      stock: 'স্টক',
      unit: 'ইউনিট',
      description: 'বিবরণ',
      images: 'ছবি(;)',
    });
    toast({ title: 'CSV ডাউনলোড হয়েছে', description: `${toBn(rows.length)} টি পণ্য এক্সপোর্ট হয়েছে` });
  };

  // ── CSV ইমপোর্ট ──
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        let ok = 0;
        let fail = 0;
        for (const row of rows) {
          const name = pick(row, ['name', 'নাম', 'বাংলা নাম', 'nameBn']);
          const price = Number(pick(row, ['price', 'দাম']));
          const catKey = pick(row, ['category', 'ক্যাটাগরি স্লাগ', 'ক্যাটাগরি']);
          if (!name || !price || !catKey) { fail++; continue; }
          const cat = categoriesAll.find(
            (c) => c.slug === catKey || c.name.toLowerCase() === catKey.toLowerCase() || (c.nameBn || '') === catKey
          );
          if (!cat) { fail++; continue; }
          const brandKey = pick(row, ['brand', 'ব্র্যান্ড স্লাগ', 'ব্র্যান্ড']);
          const brand = brandKey
            ? brandsAll.find((b) => b.slug === brandKey || b.name.toLowerCase() === brandKey.toLowerCase())
            : undefined;
          const images = pick(row, ['images', 'ছবি(;)', 'ছবি'])
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean);
          const res = saveProduct({
            name,
            nameBn: pick(row, ['nameBn', 'বাংলা নাম']) || null,
            price,
            categoryId: cat.id,
            brandId: brand?.id || null,
            stock: Number(pick(row, ['stock', 'স্টক'])) || 0,
            unit: pick(row, ['unit', 'ইউনিট']) || 'পিস',
            description: pick(row, ['description', 'বিবরণ']),
            images: JSON.stringify(images),
          });
          if (res.ok) ok++;
          else fail++;
        }
        if (rows.length === 0) {
          toast({ title: 'ফাইলে কোনো সারি পাওয়া যায়নি', variant: 'destructive' });
        } else {
          toast({
            title: `ইমপোর্ট সম্পন্ন — সফল: ${toBn(ok)}, ব্যর্থ: ${toBn(fail)}`,
            description: fail > 0 ? 'ব্যর্থ সারিতে নাম/দাম/ক্যাটাগরি স্লাগ ঠিক আছে কি না দেখুন' : undefined,
            variant: fail > 0 ? 'destructive' : 'default',
          });
        }
      } catch {
        toast({ title: 'CSV ফাইল পড়া যায়নি', variant: 'destructive' });
      } finally {
        setImporting(false);
        if (importRef.current) importRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setImporting(false);
      toast({ title: 'ফাইল পড়া যায়নি', variant: 'destructive' });
    };
    reader.readAsText(file, 'utf-8');
  };

  // ── বাল্ক অ্যাকশন ──
  const bulkSetActive = (active: boolean) => {
    let count = 0;
    for (const id of selected) {
      const p = products.find((x) => x.id === id);
      if (p && p.active !== active) {
        db.put('products', { ...p, active });
        count++;
      }
    }
    toast({ title: active ? `${toBn(count)} টি পণ্য প্রকাশিত হয়েছে` : `${toBn(count)} টি পণ্য অপ্রকাশিত হয়েছে` });
    setSelected(new Set());
  };

  const bulkDelete = () => {
    const count = selected.size;
    let ok = 0;
    for (const id of selected) {
      const res = deleteProduct(id);
      if (res.ok) ok++;
    }
    logAudit({
      actor: getCurrentUser()?.email || 'admin',
      action: 'product.bulk_delete',
      entity: 'product',
      details: `${ok} টি পণ্য মুছে ফেলা হয়েছে`,
    });
    toast({ title: `${toBn(ok)} টি পণ্য মুছে ফেলা হয়েছে` });
    setSelected(new Set());
    setBulkDeleteOpen(false);
    void count;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">পণ্য ম্যানেজমেন্ট</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onImportFile}
            aria-label="CSV ইমপোর্ট ফাইল"
          />
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV এক্সপোর্ট
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} disabled={importing} className="gap-1.5">
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} CSV ইমপোর্ট
          </Button>
          <Button onClick={openCreate} className="gap-1.5 font-semibold">
            <Plus className="h-4 w-4" /> নতুন পণ্য
          </Button>
        </div>
      </div>

      {/* ফিল্টার টুলবার — মোবাইলে ২-কলাম গ্রিড, সার্চ ফুল-উইডথ */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
          <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="নাম বা SKU দিয়ে খুঁজুন..."
              className="pl-9"
            />
          </div>
          <div className="flex min-w-0 sm:flex-1">
            <Select value={fCat} onValueChange={setFCat}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="ক্যাটাগরি" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব ক্যাটাগরি</SelectItem>
                {flatCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nameBn || c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 sm:flex-1">
            <Select value={fBrand} onValueChange={setFBrand}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="ব্র্যান্ড" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব ব্র্যান্ড</SelectItem>
                <SelectItem value="">ব্র্যান্ড-বিহীন</SelectItem>
                {brandsAll.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
          <div className="flex min-w-0 sm:flex-1">
            <Select value={fStock} onValueChange={setFStock}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="স্টক" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব স্টক</SelectItem>
                <SelectItem value="low">লো-স্টক (≤ ১০)</SelectItem>
                <SelectItem value="out">আউট-অব-স্টক</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 sm:flex-1">
            <Select value={fBadge} onValueChange={setFBadge}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="ব্যাজ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব ব্যাজ</SelectItem>
                <SelectItem value="featured">ফিচার্ড</SelectItem>
                <SelectItem value="new">নতুন</SelectItem>
                <SelectItem value="bestseller">বেস্ট সেলার</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 sm:flex-1">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="সাজান" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">নতুন আগে</SelectItem>
                <SelectItem value="name-asc">নাম (ক্রমানুসারে)</SelectItem>
                <SelectItem value="price-asc">দাম: কম → বেশি</SelectItem>
                <SelectItem value="price-desc">দাম: বেশি → কম</SelectItem>
                <SelectItem value="stock-asc">স্টক: কম আগে</SelectItem>
                <SelectItem value="sold-desc">সর্বাধিক বিক্রিত</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center text-xs text-muted-foreground sm:ml-auto">
            {toBn(filtered.length)} টি পণ্য{selected.size > 0 && ` • নির্বাচিত ${toBn(selected.size)}`}
          </div>
        </div>
      </div>

      {/* বাল্ক অ্যাকশন বার */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-semibold">{toBn(selected.size)} টি নির্বাচিত</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => bulkSetActive(true)} className="gap-1.5">
              <Check className="h-3.5 w-3.5" /> প্রকাশ করুন
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkSetActive(false)} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> অপ্রকাশ করুন
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> মুছুন
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>বাতিল</Button>
          </div>
        </div>
      )}

      {/* তালিকা */}
      {!mounted ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <PackageX className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো পণ্য পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* হেডার সিলেক্ট-অল */}
          <div className="flex items-center gap-3 px-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="সব নির্বাচন করুন"
            />
            <span className="text-xs text-muted-foreground">সব নির্বাচন করুন</span>
          </div>
          {filtered.map((p) => {
            const img = getProductImages(p)[0];
            const vCount = p.variants?.length || 0;
            const brand = p.brandId ? brandById.get(p.brandId) : undefined;
            return (
              <div
                key={p.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm',
                  !p.active && 'opacity-60',
                  selected.has(p.id) && 'border-primary/50 bg-primary/5'
                )}
              >
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggleSelect(p.id)}
                  aria-label={`${p.name} নির্বাচন`}
                  className="shrink-0"
                />
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {img ? (
                    <img src={img} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                      <Package className="h-5 w-5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{p.nameBn || p.name}</span>
                    {p.nameBn && p.name !== p.nameBn && (
                      <span className="hidden text-[10px] text-muted-foreground sm:inline">{p.name}</span>
                    )}
                    {p.isFeatured && (
                      <span title="ফিচার্ড" className="flex h-4.5 w-4.5 items-center justify-center rounded bg-primary/15 text-[9px] font-extrabold text-primary">F</span>
                    )}
                    {p.isNew && (
                      <span title="নতুন" className="flex h-4.5 w-4.5 items-center justify-center rounded bg-green-500/15 text-[9px] font-extrabold text-green-700">N</span>
                    )}
                    {p.isBestSeller && (
                      <span title="বেস্ট সেলার" className="flex h-4.5 w-4.5 items-center justify-center rounded bg-amber-500/15 text-[9px] font-extrabold text-amber-700">B</span>
                    )}
                    {vCount > 0 && <Badge className="bg-violet-500/10 text-[10px] text-violet-700 hover:bg-violet-500/10">{toBn(vCount)} ভ্যারিয়েন্ট</Badge>}
                    {!p.active && <Badge variant="destructive" className="text-[10px]">নিষ্ক্রিয়</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-bold text-primary">
                      {formatBDT(p.price)}
                      {p.comparePrice ? (
                        <span className="ml-1 font-normal text-[11px] text-muted-foreground/70 line-through">
                          {formatBDT(p.comparePrice)}
                        </span>
                      ) : null}
                    </span>
                    <span>SKU: {p.sku}</span>
                    <span>{catNameById.get(p.categoryId) || '—'}</span>
                    {brand && <span>{brand.name}</span>}
                    <span
                      className={cn(
                        p.stock === 0 ? 'font-bold text-destructive' : p.stock <= 10 ? 'font-bold text-amber-600' : ''
                      )}
                    >
                      স্টক: {toBn(p.stock)}
                    </span>
                    <span>বিক্রি: {toBn(p.soldCount)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="mr-1 flex items-center gap-1.5">
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">সক্রিয়</span>
                    <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} aria-label="সক্রিয় টগল" />
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} aria-label="সম্পাদনা">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => duplicate(p)} aria-label="ডুপ্লিকেট">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8" aria-label="আরও অ্যাকশন">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setStockTarget(p); setStockQty('1'); setStockDir('in'); setStockNote(''); }}>
                        <PackageMinus className="mr-2 h-4 w-4" /> স্টক অ্যাডজাস্ট
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(p)} aria-label="মুছুন">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-4 pb-3">
            <DialogTitle>{editing ? 'পণ্য সম্পাদনা' : 'নতুন পণ্য যোগ করুন'}</DialogTitle>
            <DialogDescription>
              {editing ? `"${editing.nameBn || editing.name}" এর তথ্য পরিবর্তন করুন` : 'সব আবশ্যক তথ্য পূরণ করুন'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(92vh-9rem)]">
            <div className="grid gap-5 p-4">
              {/* ── মূল তথ্য ── */}
              <section className="rounded-lg border bg-muted/30 p-3">
                <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Package className="h-4 w-4 text-primary" /> মূল তথ্য</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>পণ্যের নাম (বাংলা) <span className="text-destructive">*</span></Label>
                    <Input value={form.nameBn} onChange={(e) => setForm({ ...form, nameBn: e.target.value })} placeholder="যেমন: সেইলর প্রিমিয়াম প্যানজাবি" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>পণ্যের নাম (ইংরেজি)</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sailor Premium Panjabi" className="mt-1.5" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>স্লাগ (স্বয়ংক্রিয়)</Label>
                    <Input value={slugHint} readOnly disabled className="mt-1.5 font-mono text-xs" />
                    <p className="mt-1 text-[11px] text-muted-foreground">নাম থেকে স্বয়ংক্রিয়ভাবে তৈরি হবে — সম্পাদনা করার দরকার নেই</p>
                  </div>
                  <div>
                    <Label>SKU</Label>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="খালি রাখলে স্বয়ংক্রিয় TS-কোড" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>ইউনিট</Label>
                    <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="পিস / সেট / জোড়া" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>উৎস (Origin)</Label>
                    <Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Bangladesh" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>ওজন/পরিমাণ</Label>
                    <Input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="৫০০ গ্রাম" className="mt-1.5" />
                  </div>
                </div>
              </section>

              {/* ── বর্ণনা ── */}
              <section className="rounded-lg border bg-muted/30 p-3">
                <h4 className="mb-3 text-sm font-bold">বর্ণনা</h4>
                <div className="grid gap-4">
                  <div>
                    <Label>সংক্ষিপ্ত বিবরণ</Label>
                    <Input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} placeholder="এক লাইনে পণ্যের পরিচয়" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>পূর্ণ বিবরণ</Label>
                    <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" />
                    <p className="mt-1 text-[11px] text-muted-foreground">প্রোডাক্ট পেজে নতুন লাইনসহ দেখানো হবে</p>
                  </div>
                </div>
              </section>

              {/* ── মূল্য ও স্টক ── */}
              <section className="rounded-lg border bg-muted/30 p-3">
                <h4 className="mb-3 text-sm font-bold">মূল্য ও স্টক</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label>দাম (৳) <span className="text-destructive">*</span></Label>
                    <Input type="number" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>আগের দাম (ছাড় দেখাতে)</Label>
                    <Input type="number" inputMode="numeric" value={form.comparePrice} onChange={(e) => setForm({ ...form, comparePrice: e.target.value })} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>স্টক</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={hasVariantSection ? String(totalVariantStock) : form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                      disabled={hasVariantSection}
                      className="mt-1.5"
                    />
                    {hasVariantSection && (
                      <p className="mt-1 text-[11px] text-muted-foreground">ভ্যারিয়েন্ট স্টকের যোগফল (নিচের ম্যাট্রিক্স থেকে)</p>
                    )}
                  </div>
                </div>
              </section>

              {/* ── ক্যাটাগরি ও ব্র্যান্ড ── */}
              <section className="rounded-lg border bg-muted/30 p-3">
                <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Layers className="h-4 w-4 text-primary" /> ক্যাটাগরি ও ব্র্যান্ড</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>ক্যাটাগরি <span className="text-destructive">*</span></Label>
                    <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>
                        {flatCats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nameBn || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>ব্র্যান্ড</Label>
                    <Select value={form.brandId || 'none'} onValueChange={(v) => setForm({ ...form, brandId: v === 'none' ? '' : v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">নেই</SelectItem>
                        {brandsAll.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* ── ছবি ── */}
              <section className="rounded-lg border bg-muted/30 p-3">
                <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><ImagePlus className="h-4 w-4 text-primary" /> পণ্যের ছবি ({toBn(form.images.length)} টি)</h4>
                {form.images.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {form.images.map((img, idx) => (
                      <div key={`${img}-${idx}`} className="relative h-16 w-16 overflow-hidden rounded-lg border-2 border-primary">
                        <img src={img} alt={`ছবি ${idx + 1}`} className="h-full w-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute left-0 top-0 bg-primary px-1 text-[8px] font-bold text-white">প্রধান</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white"
                          aria-label="ছবি সরান"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => setPrimaryImage(idx)}
                            className="absolute bottom-0.5 left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/90 text-[8px] font-bold text-primary shadow"
                            title="প্রধান ছবি করুন"
                            aria-label="প্রধান ছবি করুন"
                          >
                            ★
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <ImageUploadField
                  value=""
                  onChange={(url) => url && addImage(url)}
                  folder="products"
                  label="নতুন ছবি আপলোড"
                  hint="প্রথম ছবিটি প্রধান ছবি হিসেবে দেখানো হয়; থাম্বনেইলে ★ চেপে প্রধান বদলান"
                />
                <div className="mt-3 flex gap-2">
                  <Input
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="অথবা ছবির URL লিখুন (/products/tshirt.png)"
                    aria-label="ছবির URL"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { addImage(imageUrlInput); setImageUrlInput(''); }}
                    className="shrink-0"
                  >
                    যোগ করুন
                  </Button>
                </div>
              </section>

              {/* ── রং (কালার এডিটর) ── */}
              <section className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <Palette className="h-4 w-4 text-primary" /> রং — ব্যবহারকারী এগুলো থেকে বেছে নেবে
                </div>
                {form.colors.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {form.colors.map((c) => (
                      <div key={c.name} className="flex items-center gap-2 rounded-lg border bg-background p-2">
                        <input
                          type="color"
                          value={c.hex || '#dddddd'}
                          onChange={(e) => updateColorHex(c.name, e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border bg-background p-0.5"
                          aria-label={`${c.name} রং`}
                        />
                        <Input
                          value={c.name}
                          onChange={(e) => updateColorName(c.name, e.target.value)}
                          className="h-8 flex-1 text-xs"
                          aria-label="রং-এর নাম"
                        />
                        <button onClick={() => removeColor(c.name)} className="text-muted-foreground hover:text-destructive" aria-label={`${c.name} মুছুন`}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={colorNameInput}
                    onChange={(e) => setColorNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColor(); } }}
                    placeholder="রং-এর নাম লিখুন (যেমন: লাল, নেভি নীল)"
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={addColor} className="shrink-0">যোগ করুন</Button>
                </div>
              </section>

              {/* ── সাইজ ── */}
              <section className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <Ruler className="h-4 w-4 text-primary" /> সাইজ — ব্যবহারকারী এগুলো থেকে বেছে নেবে
                </div>
                {form.sizes.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {form.sizes.map((s) => (
                      <span key={s} className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium">
                        {s}
                        <button onClick={() => removeSize(s)} className="text-muted-foreground hover:text-destructive" aria-label={`${s} মুছুন`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } }}
                    placeholder="সাইজ লিখুন (যেমন: M, XL, ৪০, ১০০ml)"
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={addSize} className="shrink-0">যোগ করুন</Button>
                </div>
              </section>

              {/* ── ভ্যারিয়েন্ট ম্যাট্রিক্স ── */}
              {hasVariantSection ? (
                <section className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                    <Layers className="h-4 w-4 text-primary" /> ভ্যারিয়েন্ট কম্বিনেশন ({toBn(form.variants.length)} টি)
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    প্রতিটি রং/সাইজ কম্বিনেশনের জন্য আলাদা দাম, স্টক ও ছবি দিন। খালি দাম রাখলে মূল দাম ({formatBDT(Number(form.price) || 0)}) ব্যবহৃত হবে।
                  </p>
                  <div className="max-h-72 space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
                    {form.variants.map((v) => (
                      <div key={v.key} className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
                        {v.color && (
                          <span className="h-5 w-5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: v.colorHex || '#ddd' }} />
                        )}
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {[v.color, v.size].filter(Boolean).join(' / ') || 'ডিফল্ট'}
                        </span>
                        {/* ভ্যারিয়েন্ট ছবি */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="h-8 w-8 shrink-0 overflow-hidden rounded border bg-muted"
                              title="ভ্যারিয়েন্ট ছবি"
                              aria-label="ভ্যারিয়েন্ট ছবি নির্বাচন"
                            >
                              {v.image ? (
                                <img src={v.image} alt="ভ্যারিয়েন্ট ছবি" className="h-full w-full object-cover" />
                              ) : (
                                <ImagePlus className="mx-auto h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {form.images.length === 0 && (
                              <DropdownMenuItem disabled>আগে পণ্যের ছবি যোগ করুন</DropdownMenuItem>
                            )}
                            {form.images.map((img, i) => (
                              <DropdownMenuItem key={`${img}-${i}`} onClick={() => setVariantImage(v.key, img)}>
                                <img src={img} alt="" className="mr-2 h-6 w-6 rounded object-cover" />
                                ছবি {toBn(i + 1)}
                              </DropdownMenuItem>
                            ))}
                            {v.image && (
                              <DropdownMenuItem onClick={() => setVariantImage(v.key, null)}>
                                <X className="mr-2 h-4 w-4" /> ছবি মুছুন
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Input
                          type="number"
                          value={v.price}
                          onChange={(e) => updateVariant(v.key, 'price', e.target.value)}
                          placeholder="দাম"
                          className="h-8 w-20 text-xs"
                          aria-label="ভ্যারিয়েন্ট দাম"
                        />
                        <Input
                          type="number"
                          value={v.stock}
                          onChange={(e) => updateVariant(v.key, 'stock', e.target.value)}
                          placeholder="স্টক"
                          className="h-8 w-16 text-xs"
                          aria-label="ভ্যারিয়েন্ট স্টক"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-medium text-muted-foreground">
                    মোট ভ্যারিয়েন্ট স্টক: {toBn(totalVariantStock)} টি
                  </div>
                </section>
              ) : (
                <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                  রং বা সাইজ নেই — এটি সাধারণ (সিম্পল) পণ্য হিসেবে সেভ হবে
                </p>
              )}

              {/* ── ব্যাজ ও স্ট্যাটাস ── */}
              <section className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3">
                {([
                  ['active', 'সক্রিয়'],
                  ['isFeatured', 'ফিচার্ড পণ্য'],
                  ['isNew', 'নতুন পণ্য'],
                  ['isBestSeller', 'বেস্ট সেলার'],
                  ['isPreOrder', 'প্রি-অর্ডার'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch
                      checked={form[key]}
                      onCheckedChange={(v) => setForm({ ...form, [key]: !!v })}
                    />
                    {label}
                  </label>
                ))}
              </section>
            </div>
          </ScrollArea>

          <div className="flex gap-2 border-t p-4">
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
            <AlertDialogTitle>পণ্যটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.nameBn || deleteTarget?.name}&quot; স্থায়ীভাবে মুছে যাবে। এই কাজ ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">হ্যাঁ, মুছুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toBn(selected.size)} টি পণ্য মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              নির্বাচিত সব পণ্য স্থায়ীভাবে মুছে যাবে। এই কাজ ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-white hover:bg-destructive/90">হ্যাঁ, মুছুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* স্টক অ্যাডজাস্ট ডায়ালগ */}
      <Dialog open={!!stockTarget} onOpenChange={(o) => !o && setStockTarget(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>স্টক অ্যাডজাস্ট</DialogTitle>
            <DialogDescription>
              {stockTarget?.nameBn || stockTarget?.name} — বর্তমান স্টক: {toBn(stockTarget?.stock ?? 0)} টি
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>ধরন</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={stockDir === 'in' ? 'default' : 'outline'}
                  onClick={() => setStockDir('in')}
                  className="font-semibold"
                >
                  + স্টক ইন
                </Button>
                <Button
                  type="button"
                  variant={stockDir === 'out' ? 'default' : 'outline'}
                  onClick={() => setStockDir('out')}
                  className="font-semibold"
                >
                  − স্টক আউট
                </Button>
              </div>
            </div>
            <div>
              <Label>পরিমাণ</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>নোট (ঐচ্ছিক)</Label>
              <Input
                value={stockNote}
                onChange={(e) => setStockNote(e.target.value)}
                placeholder="যেমন: নতুন চালান, ক্ষতিগ্রস্ত পণ্য"
                className="mt-1.5"
              />
            </div>
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              নতুন স্টক হবে: {toBn(Math.max(0, (stockTarget?.stock ?? 0) + (stockDir === 'in' ? Math.abs(Number(stockQty) || 0) : -Math.abs(Number(stockQty) || 0))))} টি
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStockTarget(null)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={applyStockAdjust}>আপডেট করুন</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Plus, Save, FileText, Trash2, Globe, Eye, Pencil, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { db, uid } from '@/lib/db/core';
import { useCollection } from '@/lib/db/hooks';
import { logAudit } from '@/lib/db/services';
import type { CmsPage } from '@/lib/db/types';
import { toBn, formatBnDate } from '@/lib/types';
import { cn } from '@/lib/utils';

/** সিড করা পেজগুলোর স্লাগ — এগুলোর স্লাগ পরিবর্তনযোগ্য নয়, ডিলিটও নয় */
const SEEDED_SLUGS = ['about', 'contact', 'faq', 'shipping', 'cancellation', 'terms', 'privacy', 'stories'];

/** টাইটেল থেকে স্লাগ প্রস্তাব */
function suggestSlug(title: string, existing: string[]): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF\s-]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `page-${Date.now().toString(36).slice(-5)}`;
  let slug = base;
  let n = 2;
  while (existing.includes(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export function AdminCms() {
  const { toast } = useToast();
  const pages = useCollection('pages');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  const sorted = useMemo(() => [...pages].sort((a, b) => a.title.localeCompare(b.title, 'bn')), [pages]);
  const publishedPages = sorted.filter((p) => p.published);

  // সিলেকশন: বৈধ সিলেক্টেড আইডি না থাকলে প্রথম পেজ (ডেরাইভড — ইফেক্ট ছাড়া)
  const effectiveId = selectedId && pages.some((p) => p.id === selectedId) ? selectedId : sorted[0]?.id ?? null;
  const selected = pages.find((p) => p.id === effectiveId) || null;

  const openCreate = () => {
    setNewTitle('');
    setNewSlug('');
    setSlugTouched(false);
    setCreateOpen(true);
  };

  const createPage = () => {
    const title = newTitle.trim();
    if (!title) {
      toast({ title: 'পেজের টাইটেল লিখুন', variant: 'destructive' });
      return;
    }
    const slug = (slugTouched ? newSlug.trim() : suggestSlug(title, pages.map((p) => p.slug))).toLowerCase();
    if (!slug) {
      toast({ title: 'স্লাগ দিন', variant: 'destructive' });
      return;
    }
    if (pages.some((p) => p.slug === slug)) {
      toast({ title: 'এই স্লাগ আগেই ব্যবহৃত হয়েছে', variant: 'destructive' });
      return;
    }
    const page: CmsPage = {
      id: uid('page_'),
      slug,
      title,
      content: '',
      published: false,
      seoTitle: null,
      seoDescription: null,
      updatedAt: new Date().toISOString(),
    };
    db.append('pages', page);
    logAudit({ actor: 'admin', action: 'cms.page_create', entity: 'page', entityId: slug });
    setSelectedId(page.id);
    setCreateOpen(false);
    toast({ title: 'পেজ তৈরি হয়েছে', description: slug });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">CMS পেজ</h2>
          <p className="text-xs text-muted-foreground">তথ্য পেজ সম্পাদনা করুন — সাইটের ফুটারে অটো দেখায়</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন পেজ
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Page list */}
        <div className="rounded-xl border bg-card">
          <div className="border-b px-3 py-2.5 text-xs font-bold text-muted-foreground">
            পেজ তালিকা ({toBn(sorted.length)})
          </div>
          <ScrollArea className="max-h-[420px]">
            <div className="p-2">
              {sorted.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent',
                    effectiveId === p.id && 'bg-primary/10 font-semibold text-primary',
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <Badge variant={p.published ? 'secondary' : 'outline'} className={cn('shrink-0 text-[9px]', p.published && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300')}>
                    {p.published ? 'প্রকাশিত' : 'ড্রাফট'}
                  </Badge>
                </button>
              ))}
              {sorted.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">কোনো পেজ নেই</p>}
            </div>
          </ScrollArea>
        </div>

        {/* Editor — key দিয়ে পেজ বদলালে ফর্ম রিসেট হয় */}
        {selected ? (
          <PageEditor key={selected.id} page={selected} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
            <FileText className="mb-2 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">বাম থেকে একটি পেজ নির্বাচন করুন</p>
          </div>
        )}
      </div>

      {/* Footer links + preview info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Eye className="h-4 w-4 text-primary" /> ফুটার লিঙ্ক
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">নিচের প্রকাশিত পেজগুলো সাইটের ফুটারে অটো যুক্ত হয়:</p>
          <div className="flex flex-wrap gap-1.5">
            {publishedPages.length === 0 ? (
              <span className="text-xs text-muted-foreground">কোনো প্রকাশিত পেজ নেই</span>
            ) : (
              publishedPages.map((p) => (
                <Badge key={p.id} variant="outline" className="text-[10px]">
                  {p.title} <span className="ml-1 font-mono text-[9px] text-muted-foreground">/{p.slug}</span>
                </Badge>
              ))
            )}
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/30 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="text-sm font-bold">প্রিভিউ</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              সেভ করার পর সাইটের <span className="font-semibold text-foreground">যোগাযোগ / তথ্য পেজ</span> খুলে পরিবর্তন দেখুন — কাস্টম পেজগুলো ফুটার লিঙ্ক থেকেও খোলা যায়।
            </p>
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" /> নতুন পেজ তৈরি</DialogTitle>
            <DialogDescription>টাইটেল দিলে স্লাগ স্বয়ংক্রিয়ভাবে প্রস্তাব হবে</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>পেজের টাইটেল <span className="text-destructive">*</span></Label>
              <Input
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (!slugTouched) setNewSlug(suggestSlug(e.target.value, pages.map((p) => p.slug)));
                }}
                placeholder="যেমন: রিটার্ন পলিসি"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>স্লাগ</Label>
              <Input
                value={newSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setNewSlug(e.target.value);
                }}
                placeholder="return-policy"
                className="mt-1.5 font-mono text-xs"
              />
              {newSlug && pages.some((p) => p.slug === newSlug.trim().toLowerCase()) && (
                <p className="mt-1 text-[11px] text-destructive">এই স্লাগ আগেই আছে — অন্যটি দিন</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={createPage}>তৈরি করুন</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────────────────────── পেজ এডিটর ─────────────────────────────

function PageEditor({ page }: { page: CmsPage }) {
  const { toast } = useToast();
  const pages = useCollection('pages');
  const isSeeded = SEEDED_SLUGS.includes(page.slug);

  const [form, setForm] = useState({
    title: page.title,
    slug: page.slug,
    content: page.content,
    published: page.published,
    seoTitle: page.seoTitle || '',
    seoDescription: page.seoDescription || '',
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const save = () => {
    const slug = isSeeded ? page.slug : form.slug.trim().toLowerCase();
    if (!form.title.trim()) {
      toast({ title: 'টাইটেল লিখুন', variant: 'destructive' });
      return;
    }
    if (!isSeeded && !slug) {
      toast({ title: 'স্লাগ লিখুন', variant: 'destructive' });
      return;
    }
    if (!isSeeded && slug !== page.slug && pages.some((p) => p.slug === slug)) {
      toast({ title: 'এই স্লাগ আগেই ব্যবহৃত হয়েছে', variant: 'destructive' });
      return;
    }
    db.put('pages', {
      ...page,
      title: form.title.trim(),
      slug,
      content: form.content,
      published: form.published,
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      updatedAt: new Date().toISOString(),
    });
    logAudit({ actor: 'admin', action: 'cms.page_update', entity: 'page', entityId: slug });
    toast({ title: 'পেজ সেভ হয়েছে', description: form.published ? 'সাইটে প্রকাশিত' : 'ড্রাফট হিসেবে সেভ' });
  };

  const confirmDelete = () => {
    db.remove('pages', page.id);
    logAudit({ actor: 'admin', action: 'cms.page_delete', entity: 'page', entityId: page.slug });
    setDeleteOpen(false);
    toast({ title: 'পেজ মুছে ফেলা হয়েছে' });
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            শেষ আপডেট: {formatBnDate(page.updatedAt)}
          </div>
          {!isSeeded && (
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> মুছুন
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>টাইটেল</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>স্লাগ</Label>
            <div className="relative mt-1.5">
              <Globe className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                disabled={isSeeded}
                className="pl-9 font-mono text-xs"
              />
            </div>
            {isSeeded && <p className="mt-1 text-[11px] text-muted-foreground">সিস্টেম পেজ — স্লাগ পরিবর্তনযোগ্য নয়</p>}
          </div>
        </div>

        <div>
          <Label>কনটেন্ট</Label>
          <Textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="mt-1.5 min-h-[320px]"
            placeholder="পেজের লেখা এখানে..."
          />
          <p className="mt-1 text-[11px] text-muted-foreground">ফাঁকা লাইন = নতুন প্যারাগ্রাফ</p>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
          প্রকাশিত (সাইটে দেখা যাবে)
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>SEO টাইটেল (ঐচ্ছিক)</Label>
            <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>SEO বর্ণনা (ঐচ্ছিক)</Label>
            <Input value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} className="mt-1.5" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} className="gap-1.5 font-semibold sm:w-44">
            <Save className="h-4 w-4" /> সেভ করুন
          </Button>
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>পেজটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{page.title}&quot; ({page.slug}) স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
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

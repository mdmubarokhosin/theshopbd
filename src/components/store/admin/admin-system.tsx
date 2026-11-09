'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Download, Upload, RotateCcw, Image as ImageIcon, Trash2, HardDrive,
  Activity, Database, Info, ServerCog, Loader2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db/core';
import { useCollection, useDB } from '@/lib/db/hooks';
import { deleteMedia } from '@/lib/db/services';
import { toBn, formatBnDate } from '@/lib/types';
import { cn } from '@/lib/utils';

// ───────────────────────────── ব্যাকআপ ও রিস্টোর ─────────────────────────────

function BackupTab() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingJson, setPendingJson] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);

  const downloadBackup = () => {
    const json = db.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    a.href = url;
    a.download = `the-shop-bd-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'ব্যাকআপ ডাউনলোড হয়েছে', description: 'ফাইলটি নিরাপদে সংরক্ষণ করুন' });
  };

  const onFilePick = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text) {
        toast({ title: 'ফাইল পড়া যায়নি', variant: 'destructive' });
        return;
      }
      setPendingJson(text);
    };
    reader.onerror = () => {
      toast({ title: 'ফাইল পড়া যায়নি', description: 'অন্য ফাইল দিয়ে চেষ্টা করুন', variant: 'destructive' });
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!pendingJson) return;
    setImporting(true);
    try {
      const res = db.importJson(pendingJson);
      if (res.ok) {
        toast({ title: 'ব্যাকআপ রিস্টোর সম্পন্ন হয়েছে', description: 'সব ডেটা প্রতিস্থাপিত হয়েছে' });
      } else {
        toast({ title: 'ইমপোর্ট ব্যর্থ', description: res.error, variant: 'destructive' });
      }
    } catch (err) {
      // করাপ্টেড/ভুল ফরম্যাটের ব্যাকআপে normalize ধাপে থ্রো হতে পারে — চুপচাপ ব্যর্থ না করে জানান
      toast({ title: 'ইমপোর্ট ব্যর্থ', description: err instanceof Error ? err.message.slice(0, 120) : 'ফাইলটি অবৈধ', variant: 'destructive' });
    } finally {
      setImporting(false);
      setPendingJson(null);
    }
  };

  const confirmReset = () => {
    db.resetAll();
    setResetStep(0);
    toast({ title: 'ফ্যাক্টরি রিসেট সম্পন্ন', description: 'সব ডেটা ডিফল্ট অবস্থায় ফিরে গেছে' });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <Database className="h-4 w-4 text-primary" /> ব্যাকআপ ডাউনলোড
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          সব ডেটা (পণ্য, অর্ডার, কাস্টমার, সেটিংস, কুপন...) একটি JSON ফাইলে ডাউনলোড হবে — নিয়মিত ব্যাকআপ নিন।
        </p>
        <Button onClick={downloadBackup} className="gap-1.5 font-semibold">
          <Download className="h-4 w-4" /> ব্যাকআপ ডাউনলোড (JSON)
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <Upload className="h-4 w-4 text-primary" /> ব্যাকআপ রিস্টোর
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          আগের ব্যাকআপ ফাইল আপলোড করে সব ডেটা ফিরিয়ে আনুন। বর্তমান ডেটা প্রতিস্থাপিত হবে।
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFilePick(f);
            e.target.value = '';
          }}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5 font-semibold">
          <Upload className="h-4 w-4" /> JSON ফাইল নির্বাচন করুন
        </Button>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-destructive">
          <AlertTriangle className="h-4 w-4" /> ডেঞ্জার জোন
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          ফ্যাক্টরি রিসেট করলে সব পণ্য, অর্ডার, কাস্টমার ও সেটিংস মুছে ডিফল্ট ডেমো ডেটা ফিরে আসবে — ফেরানো যাবে না।
        </p>
        <Button variant="destructive" onClick={() => setResetStep(1)} className="gap-1.5 font-semibold">
          <RotateCcw className="h-4 w-4" /> ফ্যাক্টরি রিসেট
        </Button>
      </div>

      {/* Import confirm */}
      <AlertDialog open={!!pendingJson} onOpenChange={(o) => !o && setPendingJson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ব্যাকআপ রিস্টোর করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              বর্তমান সব ডেটা প্রতিস্থাপিত হবে! ব্যাকআপ ফাইলের ডেটা বর্তমান ডেটার জায়গা নেবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport} disabled={importing} className="bg-destructive text-white hover:bg-destructive/90">
              {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> রিস্টোর হচ্ছে...</> : 'হ্যাঁ, রিস্টোর করুন'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirm — ধাপ ১ */}
      <AlertDialog open={resetStep === 1} onOpenChange={(o) => !o && setResetStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ফ্যাক্টরি রিসেট — নিশ্চিত?</AlertDialogTitle>
            <AlertDialogDescription>
              এটি সব ডেটা মুছে দেবে। আগে ব্যাকআপ নিয়েছেন কি? এই কাজ ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={() => setResetStep(2)} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, চালিয়ে যান
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirm — ধাপ ২ */}
      <AlertDialog open={resetStep === 2} onOpenChange={(o) => !o && setResetStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>শেষবার জিজ্ঞেস করছি</AlertDialogTitle>
            <AlertDialogDescription>
              সত্যিই সব ডেটা মুছে ফ্যাক্টরি ডিফল্টে ফিরতে চান? এই পদক্ষেপ অপরিবর্তনীয়।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, রিসেট করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ───────────────────────────── মিডিয়া লাইব্রেরি ─────────────────────────────

function MediaTab() {
  const { toast } = useToast();
  const mediaRaw = useCollection('media');
  // RTDB রাউন্ড-ট্রিপ/ব্যাকআপে media এন্ট্রিতে null/অসম্পূর্ণ রেকর্ড আসতে পারে — ফিল্টার করে নিন
  const media = useMemo(
    () => (Array.isArray(mediaRaw) ? mediaRaw : []).filter((m) => !!m && typeof m === 'object' && typeof m.id === 'string'),
    [mediaRaw],
  );

  const totalBytes = media.reduce((s, m) => s + m.size, 0);

  const remove = (id: string, name: string) => {
    deleteMedia(id);
    toast({ title: 'মিডিয়া মুছে ফেলা হয়েছে', description: name });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-xl border bg-card px-4 py-2.5 text-center">
          <div className="text-lg font-extrabold">{toBn(media.length)}</div>
          <div className="text-[11px] text-muted-foreground">মোট ফাইল</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-2.5 text-center">
          <div className="text-lg font-extrabold">{toBn(Math.round(totalBytes / 1024))} KB</div>
          <div className="text-[11px] text-muted-foreground">আনুমানিক স্টোরেজ</div>
        </div>
        <p className="min-w-0 flex-1 rounded-xl border border-dashed bg-muted/30 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground">
          localStorage কোটা ~৫MB — পুরোনো ছবি মুছে ফেলুন প্রয়োজনে, নাহলে নতুন আপলোড ব্যর্থ হতে পারে।
        </p>
      </div>

      {media.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <ImageIcon className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">মিডিয়া লাইব্রেরি খালি — পণ্য/লোগো আপলোড করলে এখানে জমা হবে</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {media.map((m) => (
            <div key={m.id} className="group overflow-hidden rounded-xl border bg-card">
              <div className="flex h-24 items-center justify-center overflow-hidden bg-muted/40">
                <img src={m.dataUrl} alt={m.name} className="h-full w-full object-contain" />
              </div>
              <div className="p-2">
                <div className="truncate text-xs font-semibold" title={m.name}>{m.name}</div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{toBn(Math.max(1, Math.round(m.size / 1024)))} KB</span>
                  <span>{formatBnDate(m.createdAt)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1.5 h-7 w-full gap-1 text-[11px] text-destructive hover:bg-destructive/10"
                  onClick={() => remove(m.id, m.name)}
                >
                  <Trash2 className="h-3 w-3" /> মুছুন
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── সিস্টেম হেলথ ─────────────────────────────

const COUNTED_COLLECTIONS: { key: 'products' | 'orders' | 'users' | 'reviews' | 'coupons' | 'pages' | 'transactions' | 'media' | 'notifications' | 'auditLogs' | 'stockMovements' | 'expenses' | 'addresses' | 'tickets'; label: string }[] = [
  { key: 'products', label: 'পণ্য' },
  { key: 'orders', label: 'অর্ডার' },
  { key: 'users', label: 'ইউজার' },
  { key: 'reviews', label: 'রিভিউ' },
  { key: 'coupons', label: 'কুপন' },
  { key: 'pages', label: 'CMS পেজ' },
  { key: 'transactions', label: 'ট্রানজেকশন' },
  { key: 'notifications', label: 'নোটিফিকেশন' },
  { key: 'stockMovements', label: 'স্টক মুভমেন্ট' },
  { key: 'expenses', label: 'খরচ' },
  { key: 'addresses', label: 'ঠিকানা' },
  { key: 'tickets', label: 'সাপোর্ট টিকেট' },
  { key: 'media', label: 'মিডিয়া' },
  { key: 'auditLogs', label: 'অডিট লগ' },
];

const STORAGE_LIMIT = 5 * 1024 * 1024; // ~৫MB

function HealthTab() {
  const { toast } = useToast();
  const data = useDB();

  // ডেটা বদলালে স্টোরেজ ব্যবহার পুনরায় হিসাব (ইফেক্ট/setState ছাড়া)
  const usageBytes = useMemo(() => {
    try {
      return JSON.stringify(db.get()).length;
    } catch {
      return 0;
    }
  }, [data]);

  const usageKb = Math.round(usageBytes / 1024);
  const usagePercent = Math.min(100, Math.round((usageBytes / STORAGE_LIMIT) * 100));

  const maintenanceOn = data.settings.security_maintenance_mode === '1';

  const toggleMaintenance = (v: boolean) => {
    db.updateSettings({ security_maintenance_mode: v ? '1' : '0' });
    toast({ title: v ? 'মেইনটেনেন্স মোড চালু হয়েছে' : 'মেইনটেনেন্স মোড বন্ধ হয়েছে' });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* ভার্সন */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-bold"><ServerCog className="h-4 w-4 text-primary" /> অ্যাপ ভার্সন</div>
          <div className="mt-2 text-2xl font-extrabold">v{data.settings.system_version || '1.0'}</div>
          <p className="text-[11px] text-muted-foreground">THE SHOP BD — মাল্টিব্র্যান্ড ই-কমার্স প্ল্যাটফর্ম</p>
        </div>

        {/* ডেটা ইঞ্জিন */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-bold"><HardDrive className="h-4 w-4 text-primary" /> ডেটা ইঞ্জিন</div>
          <div className="mt-2 font-extrabold">localStorage (v{toBn(data.version)})</div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{toBn(usageKb)} KB ব্যবহৃত (~৫MB-এর {toBn(usagePercent)}%)</span>
          </div>
          <Progress value={usagePercent} className={cn('mt-1.5 h-2', usagePercent > 80 && '[&>div]:bg-destructive')} />
        </div>
      </div>

      {/* কালেকশন সংখ্যা */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Database className="h-4 w-4 text-primary" /> কালেকশন হিসাব</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {COUNTED_COLLECTIONS.map((c) => (
            <div key={c.key} className="rounded-lg border bg-muted/30 p-2 text-center">
              <div className="text-base font-extrabold">{toBn((Array.isArray(data[c.key]) ? data[c.key] : []).length)}</div>
              <div className="text-[10px] text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* মেইনটেনেন্স মোড */}
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-primary" /> মেইনটেনেন্স মোড</div>
          <p className="text-xs text-muted-foreground">চালু করলে সাইটে ভিজিটররা রক্ষণাবেক্ষণ বার্তা দেখবে</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold">
          <Switch checked={maintenanceOn} onCheckedChange={toggleMaintenance} aria-label="মেইনটেনেন্স মোড টগল" />
          {maintenanceOn ? <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">চালু</Badge> : <Badge variant="secondary">বন্ধ</Badge>}
        </label>
      </div>

      {/* ভবিষ্যৎ ব্যাকএন্ড */}
      <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/30 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <span className="text-sm font-bold text-foreground">ভবিষ্যৎ ব্যাকএন্ড</span>
          <p className="mt-1">
            এই অ্যাপের সব সার্ভিস ফাংশন <code className="rounded bg-muted px-1 font-mono text-[10px]">src/lib/db/services.ts</code> ফাইলে আছে — UI কখনো সরাসরি ডেটাবেসে হাত দেয় না।
            রিয়েল সার্ভার/ডেটাবেস যোগ করতে শুধু সেই ফাইলের ফাংশনগুলো <code className="rounded bg-muted px-1 font-mono text-[10px]">fetch()</code> কলে বদলালেই হবে — কোনো UI কোড পরিবর্তন লাগবে না।
            বিস্তারিত গাইড: <code className="rounded bg-muted px-1 font-mono text-[10px]">docs/FUTURE-BACKEND.md</code>
          </p>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── মূল সেকশন ─────────────────────────────

export function AdminSystem() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">সিস্টেম</h2>
        <p className="text-xs text-muted-foreground">ব্যাকআপ, মিডিয়া লাইব্রেরি ও সিস্টেম হেলথ মনিটরিং</p>
      </div>
      <Tabs defaultValue="backup" className="gap-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="backup" className="gap-1.5"><Database className="h-4 w-4" /> ব্যাকআপ ও রিস্টোর</TabsTrigger>
          <TabsTrigger value="media" className="gap-1.5"><ImageIcon className="h-4 w-4" /> মিডিয়া লাইব্রেরি</TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5"><Activity className="h-4 w-4" /> সিস্টেম হেলথ</TabsTrigger>
        </TabsList>
        <TabsContent value="backup"><BackupTab /></TabsContent>
        <TabsContent value="media"><MediaTab /></TabsContent>
        <TabsContent value="health"><HealthTab /></TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

/**
 * অ্যাকাউন্ট ডিলিট রিকোয়েস্ট — অ্যাডমিন ম্যানেজমেন্ট সেকশন
 * ---------------------------------------------------------------------------
 * • সেটিংস: ফিচার চালু/বন্ধ + বন্ধ থাকলে ইউজারকে দেখানো কাস্টম তথ্য
 * • তালিকা: সব রিকোয়েস্ট (সার্চ + স্ট্যাটাস ফিল্টার + স্ট্যাট কার্ড)
 * • অ্যাকশন: প্রসেসিং/সম্পন্ন/বাতিল, অ্যাডমিন নোট, সম্পন্ন করার সময়
 *   ইউজারের ব্যক্তিগত ডেটা মুছে ফেলা (purge), রেকর্ড ডিলিট
 */

import { useMemo, useState } from 'react';
import {
  UserX, Clock, Loader2, CheckCircle2, XCircle, Eye, Trash2, Search, Save,
  ShieldAlert, Eraser, Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db/core';
import { useCollection, useSettings } from '@/lib/db/hooks';
import {
  deletionRequestsList, updateDeletionRequest, deleteDeletionRequest, saveSettings,
} from '@/lib/db/services';
import type { DeletionRequest, DeletionRequestStatus } from '@/lib/db/types';
import { toBn, formatBnDate } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_BN: Record<DeletionRequestStatus, string> = {
  PENDING: 'পেন্ডিং',
  PROCESSING: 'প্রসেসিং',
  COMPLETED: 'সম্পন্ন',
  REJECTED: 'বাতিল',
};

const STATUS_CLS: Record<DeletionRequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  PROCESSING: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  REJECTED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const STATUS_ICON: Record<DeletionRequestStatus, React.ComponentType<{ className?: string }>> = {
  PENDING: Clock,
  PROCESSING: Loader2,
  COMPLETED: CheckCircle2,
  REJECTED: XCircle,
};

/** সেটিংস ফর্ম — key দিয়ে রিমাউন্ট হয় (set-state-in-effect এড়াতে) */
function DeletionSettingsForm({ enabledInit, textInit }: { enabledInit: boolean; textInit: string }) {
  const { toast } = useToast();
  const [delEnabled, setDelEnabled] = useState(enabledInit);
  const [infoText, setInfoText] = useState(textInit);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings({ deletion_enabled: delEnabled ? '1' : '0', deletion_info_text: infoText });
      toast({ title: 'সেটিংস সেভ হয়েছে' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold">
        <ShieldAlert className="h-5 w-5 text-primary" /> অ্যাকাউন্ট ডিলিট রিকোয়েস্ট সেটিংস
      </h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3.5">
          <div>
            <p className="text-sm font-semibold">ইউজার ডিলিট রিকোয়েস্ট পাঠাতে পারবে</p>
            <p className="text-xs text-muted-foreground">বন্ধ করলে প্রোফাইলে শুধু যোগাযোগের তথ্য দেখানো হয়</p>
          </div>
          <Switch checked={delEnabled} onCheckedChange={setDelEnabled} />
        </div>
        <div>
          <Label>বন্ধ থাকলে কাস্টম তথ্য (ঐচ্ছিক)</Label>
          <Textarea
            className="mt-1.5 min-h-20"
            value={infoText}
            onChange={(e) => setInfoText(e.target.value)}
            placeholder="ফিচার বন্ধ থাকলে ইউজার এই লেখাটি দেখবে — যেমন: ডিলিটের জন্য support@theshopbd.com-এ মেইল করুন..."
          />
        </div>
      </div>
      <Button className="mt-4 gap-1.5" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} সেভ করুন
      </Button>
    </div>
  );
}

export function AdminDeletionRequests() {
  const { toast } = useToast();
  const settings = useSettings();
  const requests = useCollection('deletionRequests');
  const users = useCollection('users');

  const cfgKey = `${settings.deletion_enabled}|${settings.deletion_info_text}`;

  // ── তালিকা ফিল্টার ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DeletionRequestStatus>('all');

  const list = useMemo(() => deletionRequestsList(), [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.userName.toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.phone || '').includes(q) ||
        (r.reason || '').toLowerCase().includes(q)
      );
    });
  }, [list, search, statusFilter]);

  const counts = useMemo(() => ({
    PENDING: list.filter((r) => r.status === 'PENDING').length,
    PROCESSING: list.filter((r) => r.status === 'PROCESSING').length,
    COMPLETED: list.filter((r) => r.status === 'COMPLETED').length,
    REJECTED: list.filter((r) => r.status === 'REJECTED').length,
  }), [list]);

  // ── ডিটেইল ডায়ালগ ──
  const [viewId, setViewId] = useState<string | null>(null);
  const viewTarget: DeletionRequest | null = viewId ? db.findById('deletionRequests', viewId) ?? null : null;
  const [noteDraft, setNoteDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<DeletionRequestStatus>('PENDING');
  const [purgeDraft, setPurgeDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  // সম্পন্ন + purge কনফার্ম স্টেট
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completePurge, setCompletePurge] = useState(true);
  const [completeTarget, setCompleteTarget] = useState<DeletionRequest | null>(null);

  const openDetail = (r: DeletionRequest) => {
    setViewId(r.id);
    setNoteDraft(r.adminNote || '');
    setStatusDraft(r.status);
    setPurgeDraft(false);
  };

  const applyUpdate = async () => {
    if (!viewTarget) return;
    setBusy(true);
    const res = updateDeletionRequest(viewTarget.id, statusDraft, noteDraft, { purgeData: purgeDraft });
    setBusy(false);
    if (res.ok) {
      toast({
        title: 'আপডেট হয়েছে',
        description: purgeDraft && statusDraft === 'COMPLETED' ? 'ইউজারের ব্যক্তিগত ডেটাও মুছে ফেলা হয়েছে' : undefined,
      });
      setViewId(null);
    } else {
      toast({ title: 'আপডেট হয়নি', description: res.error, variant: 'destructive' });
    }
  };

  const quickStatus = (r: DeletionRequest, status: DeletionRequestStatus) => {
    if (status === 'COMPLETED') {
      setCompleteTarget(r);
      setCompleteOpen(true);
      return;
    }
    const res = updateDeletionRequest(r.id, status, r.adminNote);
    if (res.ok) toast({ title: `স্ট্যাটাস → ${STATUS_BN[status]}` });
    else toast({ title: 'হয়নি', description: res.error, variant: 'destructive' });
  };

  const confirmComplete = () => {
    const target = completeTarget;
    if (!target) return;
    const res = updateDeletionRequest(target.id, 'COMPLETED', noteDraft || target.adminNote, { purgeData: completePurge });
    setCompleteOpen(false);
    setViewId(null);
    if (res.ok) {
      toast({ title: 'রিকোয়েস্ট সম্পন্ন হয়েছে', description: completePurge ? 'ব্যক্তিগত ডেটা মুছে ফেলা হয়েছে' : undefined });
    } else {
      toast({ title: 'হয়নি', description: res.error, variant: 'destructive' });
    }
  };

  // ── রেকর্ড ডিলিট ──
  const [delTarget, setDelTarget] = useState<DeletionRequest | null>(null);
  const confirmDelete = () => {
    if (!delTarget) return;
    const res = deleteDeletionRequest(delTarget.id);
    setDelTarget(null);
    setViewId(null);
    if (res.ok) toast({ title: 'রেকর্ড ডিলিট হয়েছে' });
    else toast({ title: 'ডিলিট হয়নি', description: res.error, variant: 'destructive' });
  };

  const userExists = (userId: string) => users.some((u) => u.id === userId);

  return (
    <div className="space-y-5">
      {/* সেটিংস — key দিয়ে রিমাউন্ট (সেটিংস বদলালে ফর্ম রিসেট হয়) */}
      <DeletionSettingsForm
        key={cfgKey}
        enabledInit={settings.deletion_enabled !== '0'}
        textInit={settings.deletion_info_text || ''}
      />

      {/* স্ট্যাট কার্ড */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(Object.keys(STATUS_BN) as DeletionRequestStatus[]).map((s) => {
          const Icon = STATUS_ICON[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={cn(
                'rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md',
                statusFilter === s && 'ring-2 ring-primary'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{STATUS_BN[s]}</span>
                <Icon className={cn('h-4 w-4', s === 'PROCESSING' && 'animate-spin')} />
              </div>
              <p className="mt-1 text-2xl font-extrabold">{toBn(counts[s])}</p>
            </button>
          );
        })}
      </div>

      {/* তালিকা */}
      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <h2 className="flex items-center gap-2 font-bold">
            <UserX className="h-5 w-5 text-primary" /> রিকোয়েস্ট তালিকা ({toBn(filtered.length)})
          </h2>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
            <div className="relative sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="নাম / ইমেইল / ফোন খুঁজুন"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | DeletionRequestStatus)}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
                {(Object.keys(STATUS_BN) as DeletionRequestStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_BN[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-[32rem] divide-y overflow-y-auto scrollbar-thin">
          {filtered.length === 0 && (
            <p className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 text-muted-foreground/40" />
              কোনো রিকোয়েস্ট নেই
            </p>
          )}
          {filtered.map((r) => {
            const Icon = STATUS_ICON[r.status];
            return (
              <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <UserX className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.userName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.email || '—'} • {r.phone || '—'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatBnDate(r.createdAt)}{r.reason ? ` • ${r.reason}` : ''}
                    </p>
                    {r.dataPurged && (
                      <Badge className="mt-1 bg-zinc-100 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <Eraser className="mr-1 h-3 w-3" /> ডেটা মুছে ফেলা হয়েছে
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <Badge className={cn('gap-1', STATUS_CLS[r.status])}>
                    <Icon className={cn('h-3 w-3', r.status === 'PROCESSING' && 'animate-spin')} />
                    {STATUS_BN[r.status]}
                  </Badge>
                  {r.status === 'PENDING' && (
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => quickStatus(r, 'PROCESSING')}>
                      <Loader2 className="h-3.5 w-3.5" /> প্রসেসিং
                    </Button>
                  )}
                  {(r.status === 'PENDING' || r.status === 'PROCESSING') && (
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => quickStatus(r, 'COMPLETED')}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> সম্পন্ন
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(r)} aria-label="বিস্তারিত">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ডিটেইল ডায়ালগ */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {viewTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-destructive" /> ডিলিট রিকোয়েস্ট বিস্তারিত
                </DialogTitle>
                <DialogDescription>
                  {formatBnDate(viewTarget.createdAt)} • স্ট্যাটাস: {STATUS_BN[viewTarget.status]}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="font-semibold">{viewTarget.userName}</p>
                  <p className="text-xs text-muted-foreground">{viewTarget.email || 'ইমেইল নেই'} • {viewTarget.phone || 'ফোন নেই'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    অ্যাকাউন্ট: {userExists(viewTarget.userId) ? 'এখনো সক্রিয়' : 'ডিলিট হয়ে গেছে'}
                  </p>
                </div>
                {viewTarget.reason && (
                  <p><span className="font-medium">কারণ:</span> {viewTarget.reason}</p>
                )}
                {viewTarget.details && (
                  <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed">{viewTarget.details}</p>
                )}
                {viewTarget.processedAt && (
                  <p className="text-xs text-muted-foreground">
                    সর্বশেষ প্রসেস: {formatBnDate(viewTarget.processedAt)} • {viewTarget.processedBy || '—'}
                  </p>
                )}

                <div>
                  <Label className="text-xs font-semibold">স্ট্যাটাস পরিবর্তন</Label>
                  <Select value={statusDraft} onValueChange={(v) => setStatusDraft(v as DeletionRequestStatus)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_BN) as DeletionRequestStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_BN[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">অ্যাডমিন নোট (ইউজার দেখতে পাবে)</Label>
                  <Textarea
                    className="mt-1.5 min-h-20"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="যেমন: অনুরোধ গ্রহণ করা হয়েছে..."
                    maxLength={500}
                  />
                </div>

                {statusDraft === 'COMPLETED' && !viewTarget.dataPurged && (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <Checkbox checked={purgeDraft} onCheckedChange={(v) => setPurgeDraft(v === true)} className="mt-0.5" />
                    <span className="text-xs leading-relaxed">
                      <strong className="text-destructive">ব্যক্তিগত ডেটা মুছে ফেলুন</strong> — প্রোফাইল, ঠিকানা, নোটিফিকেশন, টিকেট, লয়ালটি ও রেফারেল ডেটা স্থায়ীভাবে মুছে যাবে (অর্ডার রেকর্ড হিসাবের জন্য থাকবে)।
                    </span>
                  </label>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setDelTarget(viewTarget)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> রেকর্ড ডিলিট
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setViewId(null)}>বন্ধ করুন</Button>
                  <Button
                    onClick={() => {
                      if (statusDraft === 'COMPLETED' && !viewTarget.dataPurged) {
                        setCompleteTarget(viewTarget);
                        setCompletePurge(purgeDraft);
                        setCompleteOpen(true);
                      } else {
                        applyUpdate();
                      }
                    }}
                    disabled={busy}
                  >
                    {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} সেভ করুন
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* সম্পন্ন + purge কনফার্মেশন */}
      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>রিকোয়েস্ট সম্পন্ন করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {completeTarget?.userName} — এর ডিলিট রিকোয়েস্ট সম্পন্ন চিহ্নিত হবে।
              {completePurge ? ' ব্যক্তিগত ডেটাও স্থায়ীভাবে মুছে ফেলা হবে।' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3">
            <Checkbox checked={completePurge} onCheckedChange={(v) => setCompletePurge(v === true)} className="mt-0.5" />
            <span className="text-xs leading-relaxed text-muted-foreground">
              ব্যক্তিগত ডেটা মুছে ফেলুন (প্রোফাইল, ঠিকানা, নোটিফিকেশন, টিকেট, লয়ালটি/রেফারেল, পুশ টোকেন)। অর্ডার রেকর্ড হিসাবের জন্য থেকে যাবে।
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmComplete} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, সম্পন্ন করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* রেকর্ড ডিলিট কনফার্মেশন */}
      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>রেকর্ড ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {delTarget?.userName} — এর রিকোয়েস্ট রেকর্ড তালিকা থেকে মুছে যাবে (ইউজারের অ্যাকাউন্ট অপরিবর্তিত থাকবে)।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              ডিলিট করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

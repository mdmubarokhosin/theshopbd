'use client';

/**
 * অ্যাডমিন — পেমেন্ট মেথড ও ট্রানজেকশন
 * ---------------------------------------------------------------------------
 * ট্যাব ১: পেমেন্ট মেথড CRUD (লোগো, একাউন্ট, TrxID প্রয়োজন কি না, সক্রিয়)
 * ট্যাব ২: ট্রানজেকশন ভেরিফিকেশন (ভেরিফাই/ব্যর্থ), ম্যানুয়াল এন্ট্রি, CSV
 * উপরে সামারি কার্ড: অপেক্ষমাণ / আজ ভেরিফায়েড / ব্যর্থ / রিফান্ড
 */

import { useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, CreditCard, CheckCircle2, XCircle, Download,
  Search, Loader2, Wallet, Clock, ShieldCheck, ReceiptText, Undo2,
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
import { useCollection } from '@/lib/db/hooks';
import {
  verifyTransaction, createManualTransaction, downloadCSV, logAudit, getCurrentUser,
} from '@/lib/db/services';
import type { PaymentMethod, PaymentTransaction } from '@/lib/db/types';
import { formatBDT, toBn } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ImageUploadField } from './admin-ui';

// ───────────────────────────── হেল্পার ─────────────────────────────

function actorName(): string {
  return getCurrentUser()?.name || 'অ্যাডমিন';
}

function formatBnDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

const METHOD_TYPE_BN: Record<PaymentMethod['type'], string> = {
  cod: 'ক্যাশ অন ডেলিভারি',
  mobile_banking: 'মোবাইল ব্যাংকিং',
  card: 'কার্ড',
  bank_transfer: 'ব্যাংক ট্রান্সফার',
};

const METHOD_TYPE_COLOR: Record<PaymentMethod['type'], string> = {
  cod: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  mobile_banking: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  card: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  bank_transfer: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
};

const TRX_STATUS_BN: Record<PaymentTransaction['status'], string> = {
  PENDING: 'অপেক্ষমাণ',
  VERIFIED: 'ভেরিফায়েড',
  FAILED: 'ব্যর্থ',
  REFUNDED: 'রিফান্ড সম্পন্ন',
};

const TRX_STATUS_COLOR: Record<PaymentTransaction['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  VERIFIED: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  REFUNDED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
};

function TrxStatusBadge({ status }: { status: PaymentTransaction['status'] }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold', TRX_STATUS_COLOR[status])}>
      {TRX_STATUS_BN[status]}
    </span>
  );
}

type MethodForm = {
  name: string;
  type: PaymentMethod['type'];
  logo: string;
  accountNumber: string;
  instructions: string;
  needsTrxId: boolean;
  active: boolean;
  sortOrder: string;
};

const EMPTY_METHOD: MethodForm = {
  name: '', type: 'mobile_banking', logo: '', accountNumber: '', instructions: '',
  needsTrxId: true, active: true, sortOrder: '0',
};

// ───────────────────────────── মূল কম্পোনেন্ট ─────────────────────────────

export function AdminPayments() {
  const { toast } = useToast();
  const methodsRaw = useCollection('paymentMethods');
  const transactionsRaw = useCollection('transactions');

  // মেথড ফর্ম
  const [methodDialog, setMethodDialog] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [methodForm, setMethodForm] = useState<MethodForm>(EMPTY_METHOD);
  const [savingMethod, setSavingMethod] = useState(false);
  const [deleteMethod, setDeleteMethod] = useState<PaymentMethod | null>(null);

  // ট্রানজেকশন ফিল্টার
  const [trxSearch, setTrxSearch] = useState('');
  const [trxStatus, setTrxStatus] = useState('all');

  // ম্যানুয়াল ট্রানজেকশন
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ orderNumber: '', methodId: '', amount: '', trxId: '', note: '' });
  const [manualSaving, setManualSaving] = useState(false);

  const methods = useMemo(
    () => [...methodsRaw].sort((a, b) => a.sortOrder - b.sortOrder),
    [methodsRaw]
  );

  const transactions = useMemo(
    () => [...transactionsRaw].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [transactionsRaw]
  );

  const filteredTrx = useMemo(
    () =>
      transactions.filter((t) => {
        if (trxStatus !== 'all' && t.status !== trxStatus) return false;
        const q = trxSearch.trim().toLowerCase();
        if (q && !`${t.orderNumber} ${t.trxId || ''}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    [transactions, trxStatus, trxSearch]
  );

  // সামারি
  const summary = useMemo(() => {
    const pending = transactions.filter((t) => t.status === 'PENDING');
    const todayKey = new Date().toISOString().slice(0, 10);
    const verifiedToday = transactions.filter((t) => t.status === 'VERIFIED' && (t.verifiedAt || '').slice(0, 10) === todayKey);
    const failed = transactions.filter((t) => t.status === 'FAILED');
    const refunded = transactions.filter((t) => t.status === 'REFUNDED');
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, t) => s + t.amount, 0),
      verifiedToday: verifiedToday.length,
      failedCount: failed.length,
      refundedTotal: refunded.reduce((s, t) => s + t.amount, 0),
    };
  }, [transactions]);

  // ── মেথড CRUD ──
  const openCreateMethod = () => {
    setEditingMethod(null);
    setMethodForm({ ...EMPTY_METHOD, sortOrder: String(methods.length + 1) });
    setMethodDialog(true);
  };

  const openEditMethod = (m: PaymentMethod) => {
    setEditingMethod(m);
    setMethodForm({
      name: m.name,
      type: m.type,
      logo: m.logo || '',
      accountNumber: m.accountNumber || '',
      instructions: m.instructions || '',
      needsTrxId: m.needsTrxId,
      active: m.active,
      sortOrder: String(m.sortOrder),
    });
    setMethodDialog(true);
  };

  const saveMethod = () => {
    if (!methodForm.name.trim()) {
      toast({ title: 'মেথডের নাম লিখুন', variant: 'destructive' });
      return;
    }
    setSavingMethod(true);
    const method: PaymentMethod = {
      id: editingMethod?.id || uid('pay_'),
      name: methodForm.name.trim(),
      type: methodForm.type,
      logo: methodForm.logo || null,
      accountNumber: methodForm.accountNumber.trim() || null,
      instructions: methodForm.instructions.trim() || null,
      needsTrxId: methodForm.needsTrxId,
      active: methodForm.active,
      sortOrder: Number(methodForm.sortOrder) || 0,
    };
    db.put('paymentMethods', method);
    logAudit({
      actor: actorName(),
      action: editingMethod ? 'payment_method.update' : 'payment_method.create',
      entity: 'paymentMethod',
      entityId: method.id,
      details: `${method.name} (${METHOD_TYPE_BN[method.type]})`,
    });
    setSavingMethod(false);
    setMethodDialog(false);
    toast({ title: editingMethod ? 'পেমেন্ট মেথড আপডেট হয়েছে' : 'পেমেন্ট মেথড যোগ হয়েছে', description: method.name });
  };

  const toggleMethodActive = (m: PaymentMethod, active: boolean) => {
    db.put('paymentMethods', { ...m, active });
    logAudit({ actor: actorName(), action: 'payment_method.toggle', entity: 'paymentMethod', entityId: m.id, details: `${m.name} → ${active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}` });
  };

  const confirmDeleteMethod = () => {
    if (!deleteMethod) return;
    db.remove('paymentMethods', deleteMethod.id);
    logAudit({ actor: actorName(), action: 'payment_method.delete', entity: 'paymentMethod', entityId: deleteMethod.id, details: deleteMethod.name });
    toast({ title: 'পেমেন্ট মেথড মুছে ফেলা হয়েছে', description: deleteMethod.name });
    setDeleteMethod(null);
  };

  // ── ট্রানজেকশন ──
  const doVerify = (t: PaymentTransaction, status: 'VERIFIED' | 'FAILED') => {
    const res = verifyTransaction(t.id, status, actorName());
    if (res.ok) {
      toast({
        title: status === 'VERIFIED' ? 'ট্রানজেকশন ভেরিফায়েড হয়েছে ✓' : 'ট্রানজেকশন ব্যর্থ হিসেবে চিহ্নিত হয়েছে',
        description: `${t.orderNumber} — ${formatBDT(t.amount)}`,
      });
    } else {
      toast({ title: 'সমস্যা হয়েছে', description: res.error, variant: 'destructive' });
    }
  };

  const submitManual = () => {
    const orderNumber = manualForm.orderNumber.trim();
    const amount = Number(manualForm.amount);
    if (!orderNumber) {
      toast({ title: 'অর্ডার নম্বর দিন', variant: 'destructive' });
      return;
    }
    if (!manualForm.methodId) {
      toast({ title: 'পেমেন্ট মেথড বেছে নিন', variant: 'destructive' });
      return;
    }
    if (!amount || amount <= 0) {
      toast({ title: 'সঠিক পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    setManualSaving(true);
    const res = createManualTransaction({
      orderNumber,
      methodId: manualForm.methodId,
      amount,
      trxId: manualForm.trxId.trim() || undefined,
      note: manualForm.note.trim() || undefined,
    });
    setManualSaving(false);
    if (res.ok) {
      toast({ title: 'ম্যানুয়াল ট্রানজেকশন তৈরি হয়েছে', description: `${orderNumber} — ${formatBDT(amount)}` });
      setManualOpen(false);
      setManualForm({ orderNumber: '', methodId: '', amount: '', trxId: '', note: '' });
    } else {
      toast({ title: 'তৈরি করা যায়নি', description: res.error, variant: 'destructive' });
    }
  };

  const exportTrxCsv = () => {
    if (!filteredTrx.length) {
      toast({ title: 'এক্সপোর্ট করার মতো ট্রানজেকশন নেই', variant: 'destructive' });
      return;
    }
    downloadCSV(
      `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredTrx.map((t) => ({
        order_number: t.orderNumber,
        method: t.methodName,
        amount: t.amount,
        trx_id: t.trxId || '',
        sender: t.senderNumber || '',
        status: TRX_STATUS_BN[t.status],
        created: (t.createdAt || '').slice(0, 16).replace('T', ' '),
        verified_at: t.verifiedAt ? t.verifiedAt.slice(0, 16).replace('T', ' ') : '',
        verified_by: t.verifiedBy || '',
      })),
      {
        order_number: 'অর্ডার নম্বর', method: 'মেথড', amount: 'পরিমাণ', trx_id: 'TrxID',
        sender: 'প্রেরক', status: 'স্ট্যাটাস', created: 'তারিখ', verified_at: 'ভেরিফাই সময়', verified_by: 'ভেরিফাই করেছেন',
      }
    );
    toast({ title: 'CSV ডাউনলোড হয়েছে' });
  };

  const summaryCards = [
    {
      icon: Clock, label: 'অপেক্ষমাণ',
      value: `${toBn(summary.pendingCount)} টি • ${formatBDT(summary.pendingAmount)}`,
      color: 'bg-amber-500/10 text-amber-600',
    },
    {
      icon: ShieldCheck, label: 'আজ ভেরিফায়েড',
      value: `${toBn(summary.verifiedToday)} টি`,
      color: 'bg-green-500/10 text-green-600',
    },
    {
      icon: XCircle, label: 'ব্যর্থ',
      value: `${toBn(summary.failedCount)} টি`,
      color: 'bg-red-500/10 text-red-600',
    },
    {
      icon: Undo2, label: 'রিফান্ড মোট',
      value: formatBDT(summary.refundedTotal),
      color: 'bg-zinc-500/10 text-zinc-600',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">পেমেন্ট ম্যানেজমেন্ট</h2>
          <p className="text-xs text-muted-foreground">পেমেন্ট মেথড, ট্রানজেকশন ভেরিফিকেশন ও ম্যানুয়াল এন্ট্রি</p>
        </div>
      </div>

      {/* সামারি কার্ড */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <div className={cn('mb-2 flex h-9 w-9 items-center justify-center rounded-lg', c.color)}>
              <c.icon className="h-4.5 w-4.5" />
            </div>
            <div className="text-sm font-extrabold leading-tight">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="methods">
        <TabsList>
          <TabsTrigger value="methods">পেমেন্ট মেথড</TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5">
            ট্রানজেকশন
            {summary.pendingCount > 0 && (
              <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {toBn(summary.pendingCount)}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ═══════════ পেমেন্ট মেথড ═══════════ */}
        <TabsContent value="methods" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={openCreateMethod} className="gap-1.5 font-semibold">
              <Plus className="h-4 w-4" /> নতুন মেথড
            </Button>
          </div>

          {methods.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
              <CreditCard className="mb-2 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">কোনো পেমেন্ট মেথড নেই — বিকাশ, নগদ, রকেট যোগ করুন</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {methods.map((m) => (
                <div key={m.id} className={cn('flex min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:gap-3', !m.active && 'opacity-60')}>
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-1">
                    {m.logo ? (
                      <img src={m.logo} alt={m.name} width={80} height={48} className="h-full w-full object-contain" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{m.name}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', METHOD_TYPE_COLOR[m.type])}>
                        {METHOD_TYPE_BN[m.type]}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.accountNumber ? `একাউন্ট: ${m.accountNumber}` : 'একাউন্ট নেই'}
                      {m.needsTrxId ? ' • TrxID লাগবে' : ''}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 sm:shrink-0 sm:justify-start">
                    <Switch
                      checked={m.active}
                      onCheckedChange={(v) => toggleMethodActive(m, v)}
                      aria-label={`${m.name} সক্রিয় টগল`}
                    />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditMethod(m)} aria-label="সম্পাদনা">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteMethod(m)}
                      aria-label="মুছুন"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══════════ ট্রানজেকশন ═══════════ */}
        <TabsContent value="transactions" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={trxSearch}
                onChange={(e) => setTrxSearch(e.target.value)}
                placeholder="অর্ডার নম্বর বা TrxID..."
                className="pl-9"
              />
            </div>
            <Select value={trxStatus} onValueChange={setTrxStatus}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="স্ট্যাটাস" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
                {(Object.keys(TRX_STATUS_BN) as PaymentTransaction['status'][]).map((s) => (
                  <SelectItem key={s} value={s}>{TRX_STATUS_BN[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5 sm:flex-none" onClick={() => setManualOpen(true)}>
                <Plus className="h-4 w-4" /> ম্যানুয়াল
              </Button>
              <Button variant="outline" className="flex-1 gap-1.5 sm:flex-none" onClick={exportTrxCsv}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          </div>

          {filteredTrx.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
              <ReceiptText className="mb-2 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">কোনো ট্রানজেকশন পাওয়া যায়নি</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTrx.map((t) => (
                <div key={t.id} className="rounded-xl border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold">{t.orderNumber}</span>
                    <Badge variant="secondary" className="text-[10px]">{t.methodName}</Badge>
                    <TrxStatusBadge status={t.status} />
                    <span className="ml-auto text-sm font-extrabold text-primary">{formatBDT(t.amount)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {t.trxId && <span>TrxID: <span className="font-mono">{t.trxId}</span></span>}
                    {t.senderNumber && <span>প্রেরক: <span className="font-mono">{t.senderNumber}</span></span>}
                    <span>{formatBnDateTime(t.createdAt)}</span>
                    {t.verifiedBy && <span>যাচাই করেছেন: {t.verifiedBy}</span>}
                  </div>
                  {t.note && <p className="mt-1 text-xs text-muted-foreground">নোট: {t.note}</p>}
                  {t.status === 'PENDING' && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="gap-1.5" onClick={() => doVerify(t, 'VERIFIED')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> ভেরিফাই ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive hover:bg-destructive/10"
                        onClick={() => doVerify(t, 'FAILED')}
                      >
                        <XCircle className="h-3.5 w-3.5" /> ব্যর্থ ✗
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════ মেথড তৈরি/সম্পাদনা ডায়ালগ ═══════════ */}
      <Dialog open={methodDialog} onOpenChange={setMethodDialog}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMethod ? 'পেমেন্ট মেথড সম্পাদনা' : 'নতুন পেমেন্ট মেথড'}</DialogTitle>
            <DialogDescription>নাম, ধরন ও লোগো দিন — চেকআউট ও হোমপেজে ব্যবহৃত হবে</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>নাম <span className="text-destructive">*</span></Label>
                <Input
                  value={methodForm.name}
                  onChange={(e) => setMethodForm({ ...methodForm, name: e.target.value })}
                  placeholder="বিকাশ (bKash)"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>ধরন</Label>
                <Select
                  value={methodForm.type}
                  onValueChange={(v) => setMethodForm({ ...methodForm, type: v as PaymentMethod['type'] })}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(METHOD_TYPE_BN) as PaymentMethod['type'][]).map((t) => (
                      <SelectItem key={t} value={t}>{METHOD_TYPE_BN[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ImageUploadField
              label="লোগো"
              hint="PNG/SVG ভালো। উদাহরণ: bkash.svg, nagad.svg, rocket.svg"
              folder="payments"
              aspect="logo"
              value={methodForm.logo}
              onChange={(url) => setMethodForm({ ...methodForm, logo: url })}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>একাউন্ট নম্বর</Label>
                <Input
                  value={methodForm.accountNumber}
                  onChange={(e) => setMethodForm({ ...methodForm, accountNumber: e.target.value })}
                  placeholder="01711-000111 (পার্সোনাল)"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>সর্ট অর্ডার</Label>
                <Input
                  type="number"
                  value={methodForm.sortOrder}
                  onChange={(e) => setMethodForm({ ...methodForm, sortOrder: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label>নির্দেশনা (চেকআউটে দেখাবে)</Label>
              <Textarea
                value={methodForm.instructions}
                onChange={(e) => setMethodForm({ ...methodForm, instructions: e.target.value })}
                rows={2}
                placeholder="Send Money করে Transaction ID দিন"
                className="mt-1.5"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="text-sm font-semibold">Transaction ID নেবে?</div>
                <div className="text-xs text-muted-foreground">চেকআউটে TrxID ফিল্ড দেখাবে (ক্যাশ অন ডেলিভারিতে বন্ধ রাখুন)</div>
              </div>
              <Switch
                checked={methodForm.needsTrxId}
                onCheckedChange={(v) => setMethodForm({ ...methodForm, needsTrxId: v })}
                aria-label="TrxID প্রয়োজন টগল"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="text-sm font-semibold">সক্রিয়</div>
                <div className="text-xs text-muted-foreground">চেকআউটে এই মেথড দেখা যাবে</div>
              </div>
              <Switch
                checked={methodForm.active}
                onCheckedChange={(v) => setMethodForm({ ...methodForm, active: v })}
                aria-label="সক্রিয় টগল"
              />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setMethodDialog(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={saveMethod} disabled={savingMethod}>
              {savingMethod ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> সেভ হচ্ছে...</> : editingMethod ? 'আপডেট করুন' : 'যোগ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* মেথড ডিলিট কনফার্ম */}
      <AlertDialog open={!!deleteMethod} onOpenChange={(o) => !o && setDeleteMethod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>পেমেন্ট মেথডটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteMethod?.name}&quot; স্থায়ীভাবে মুছে যাবে।
              {deleteMethod?.type === 'cod' && ' সতর্কতা: এটি ক্যাশ অন ডেলিভারি মেথড — মুছলে কাস্টমাররা COD পাবে না।'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, থাক</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMethod} className="bg-destructive text-white hover:bg-destructive/90">
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════ ম্যানুয়াল ট্রানজেকশন ডায়ালগ ═══════════ */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ম্যানুয়াল ট্রানজেকশন</DialogTitle>
            <DialogDescription>COD কালেকশন বা ব্যাংক ট্রান্সফার এন্ট্রির জন্য</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>অর্ডার নম্বর <span className="text-destructive">*</span></Label>
              <Input
                value={manualForm.orderNumber}
                onChange={(e) => setManualForm({ ...manualForm, orderNumber: e.target.value })}
                placeholder="TS-YYMMDD-XXXX"
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label>পেমেন্ট মেথড <span className="text-destructive">*</span></Label>
              <Select value={manualForm.methodId} onValueChange={(v) => setManualForm({ ...manualForm, methodId: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="মেথড বেছে নিন" /></SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>পরিমাণ (৳) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  value={manualForm.amount}
                  onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>TrxID (ঐচ্ছিক)</Label>
                <Input
                  value={manualForm.trxId}
                  onChange={(e) => setManualForm({ ...manualForm, trxId: e.target.value })}
                  className="mt-1.5 font-mono"
                />
              </div>
            </div>
            <div>
              <Label>নোট (ঐচ্ছিক)</Label>
              <Input
                value={manualForm.note}
                onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                placeholder="যেমন: ডেলিভারি ম্যান ক্যাশ নিয়েছে"
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setManualOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={submitManual} disabled={manualSaving}>
              {manualSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> তৈরি হচ্ছে...</> : 'তৈরি করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

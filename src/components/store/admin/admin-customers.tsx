'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Download, Eye, Users, Ban, CheckCircle2, ShoppingCart, Wallet, CalendarDays, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db/core';
import { useCollection } from '@/lib/db/hooks';
import { customersList, updateUserAccess, ordersOfUser, downloadCSV } from '@/lib/db/services';
import type { User, Order, Address } from '@/lib/db/types';
import { formatBDT, toBn, formatBnDate, ORDER_STATUS_BN, ORDER_STATUS_COLOR } from '@/lib/types';
import { cn } from '@/lib/utils';

type Customer = User & { orderCount: number; totalSpent: number; lastOrderAt?: string | null };

const GROUP_BN: Record<string, string> = {
  regular: 'রেগুলার',
  vip: 'ভিআইপি',
  wholesale: 'হোলসেল',
};

function groupBadgeCls(group?: string | null): string {
  if (group === 'vip') return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  if (group === 'wholesale') return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
  return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function Avatar({ user }: { user: User }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-primary">{(user.name || '?').trim().charAt(0)}</span>
      )}
    </div>
  );
}

export function AdminCustomers() {
  const { toast } = useToast();
  const users = useCollection('users');
  const orders = useCollection('orders');

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ready, setReady] = useState(false);

  const [viewTarget, setViewTarget] = useState<Customer | null>(null);
  const [detailOrders, setDetailOrders] = useState<Order[]>([]);
  const [detailAddresses, setDetailAddresses] = useState<Address[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [groupDraft, setGroupDraft] = useState('regular');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);

  const customers = useMemo<Customer[]>(() => customersList(), [users, orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (groupFilter !== 'all' && (c.customerGroup || 'regular') !== groupFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      );
    });
  }, [customers, search, groupFilter, statusFilter]);

  const openDetails = (c: Customer) => {
    setViewTarget(c);
    setDetailOrders(ordersOfUser(c.id));
    setDetailAddresses(db.collection('addresses').filter((a) => a.userId === c.id));
    setNoteDraft(c.groupNote || '');
    setGroupDraft(c.customerGroup || 'regular');
  };

  const toggleStatus = (c: Customer) => {
    const next = c.status === 'active' ? 'suspended' : 'active';
    const res = updateUserAccess(c.id, { status: next });
    if (res.ok) {
      toast({ title: next === 'active' ? 'কাস্টমার সক্রিয় করা হয়েছে' : 'কাস্টমার সাসপেন্ড করা হয়েছে' });
    } else {
      toast({ title: 'সমস্যা হয়েছে', description: res.error, variant: 'destructive' });
    }
  };

  const quickGroupChange = (c: Customer, group: string) => {
    const res = updateUserAccess(c.id, { customerGroup: group });
    if (res.ok) {
      toast({ title: 'গ্রুপ পরিবর্তন হয়েছে', description: `${c.name} → ${GROUP_BN[group] ?? group}` });
    } else {
      toast({ title: 'সমস্যা হয়েছে', description: res.error, variant: 'destructive' });
    }
  };

  const saveGroupNote = async () => {
    if (!viewTarget) return;
    setSavingNote(true);
    try {
      const res = updateUserAccess(viewTarget.id, { customerGroup: groupDraft, groupNote: noteDraft.trim() || null });
      if (res.ok) {
        toast({ title: 'গ্রুপ ও নোট সেভ হয়েছে' });
        setViewTarget((prev) => (prev ? { ...prev, customerGroup: groupDraft, groupNote: noteDraft.trim() || null } : prev));
      } else {
        toast({ title: 'সমস্যা হয়েছে', description: res.error, variant: 'destructive' });
      }
    } finally {
      setSavingNote(false);
    }
  };

  const exportCsv = () => {
    downloadCSV(
      'customers.csv',
      filtered.map((c) => ({
        নাম: c.name,
        ইমেইল: c.email || '',
        ফোন: c.phone || '',
        গ্রুপ: GROUP_BN[c.customerGroup || 'regular'] || 'রেগুলার',
        অর্ডার: c.orderCount,
        'মোট খরচ': Math.round(c.totalSpent),
        যোগদান: formatBnDate(c.createdAt),
      })),
    );
    toast({ title: 'CSV ডাউনলোড হয়েছে' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">কাস্টমার ম্যানেজমেন্ট</h2>
          <p className="text-xs text-muted-foreground">গ্রুপ, স্ট্যাটাস ও অর্ডার হিস্ট্রি দেখুন — মোট {toBn(customers.length)} জন</p>
        </div>
        <Button onClick={exportCsv} variant="outline" className="gap-1.5 font-semibold">
          <Download className="h-4 w-4" /> CSV এক্সপোর্ট
        </Button>
      </div>

      {/* Toolbar — মোবাইলে ২-কলাম */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম / ইমেইল / ফোন খুঁজুন..." className="pl-9" />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger aria-label="গ্রুপ ফিল্টার"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব গ্রুপ</SelectItem>
            <SelectItem value="regular">রেগুলার</SelectItem>
            <SelectItem value="vip">ভিআইপি</SelectItem>
            <SelectItem value="wholesale">হোলসেল</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="স্ট্যাটাস ফিল্টার"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
            <SelectItem value="active">সক্রিয়</SelectItem>
            <SelectItem value="suspended">বন্ধ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!ready ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <Users className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো কাস্টমার পাওয়া যায়নি</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">কাস্টমার</th>
                  <th className="px-4 py-3 font-semibold">গ্রুপ</th>
                  <th className="px-4 py-3 font-semibold">অর্ডার</th>
                  <th className="px-4 py-3 font-semibold">মোট খরচ</th>
                  <th className="px-4 py-3 font-semibold">শেষ অর্ডার</th>
                  <th className="px-4 py-3 font-semibold">স্ট্যাটাস</th>
                  <th className="px-4 py-3 text-right font-semibold">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={cn('border-b last:border-0', c.status === 'suspended' && 'opacity-60')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={c} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{c.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{c.email || c.phone || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={c.customerGroup || 'regular'} onValueChange={(v) => quickGroupChange(c, v)}>
                        <SelectTrigger className={cn('h-8 w-28 border-0 text-xs font-semibold shadow-none', groupBadgeCls(c.customerGroup))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">রেগুলার</SelectItem>
                          <SelectItem value="vip">ভিআইপি</SelectItem>
                          <SelectItem value="wholesale">হোলসেল</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">{toBn(c.orderCount)}</td>
                    <td className="px-4 py-3 font-semibold">{formatBDT(c.totalSpent)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.lastOrderAt ? formatBnDate(c.lastOrderAt) : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={c.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}>
                        {c.status === 'active' ? 'সক্রিয়' : 'বন্ধ'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openDetails(c)} aria-label="বিস্তারিত দেখুন">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className={cn('h-8 w-8', c.status === 'active' ? 'text-destructive hover:bg-destructive/10' : 'text-emerald-600 hover:bg-emerald-500/10')}
                          onClick={() => toggleStatus(c)}
                          aria-label={c.status === 'active' ? 'সাসপেন্ড করুন' : 'সক্রিয় করুন'}
                        >
                          {c.status === 'active' ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((c) => (
              <div key={c.id} className={cn('rounded-xl border bg-card p-3', c.status === 'suspended' && 'opacity-60')}>
                <div className="flex items-center gap-3">
                  <Avatar user={c} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{c.name}</span>
                      <Badge className={cn('shrink-0 text-[10px]', groupBadgeCls(c.customerGroup))}>{GROUP_BN[c.customerGroup || 'regular'] || 'রেগুলার'}</Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{c.email || c.phone || '—'}</div>
                  </div>
                  <Badge className={c.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}>
                    {c.status === 'active' ? 'সক্রিয়' : 'বন্ধ'}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2 text-center text-xs">
                  <div><span className="block font-bold">{toBn(c.orderCount)}</span>অর্ডার</div>
                  <div><span className="block font-bold">{formatBDT(c.totalSpent)}</span>মোট খরচ</div>
                  <div><span className="block font-bold">{c.lastOrderAt ? formatBnDate(c.lastOrderAt) : '—'}</span>শেষ অর্ডার</div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Select value={c.customerGroup || 'regular'} onValueChange={(v) => quickGroupChange(c, v)}>
                    <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">রেগুলার</SelectItem>
                      <SelectItem value="vip">ভিআইপি</SelectItem>
                      <SelectItem value="wholesale">হোলসেল</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openDetails(c)}>
                    <Eye className="h-3.5 w-3.5" /> বিস্তারিত
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('h-8 gap-1.5 text-xs', c.status === 'active' ? 'text-destructive' : 'text-emerald-600')}
                    onClick={() => toggleStatus(c)}
                  >
                    {c.status === 'active' ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {c.status === 'active' ? 'বন্ধ' : 'সক্রিয়'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Details dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> কাস্টমার প্রোফাইল</DialogTitle>
            <DialogDescription>অর্ডার হিস্ট্রি, ঠিকানা ও গ্রুপ নোট পরিচালনা করুন</DialogDescription>
          </DialogHeader>

          {viewTarget && (
            <div className="space-y-4">
              {/* Profile */}
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-background">
                  {viewTarget.avatar ? (
                    <img src={viewTarget.avatar} alt={viewTarget.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base font-bold text-primary">{(viewTarget.name || '?').trim().charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{viewTarget.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{viewTarget.email || 'ইমেইল নেই'} • {viewTarget.phone || 'ফোন নেই'}</div>
                </div>
                <Badge className={viewTarget.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}>
                  {viewTarget.status === 'active' ? 'সক্রিয়' : 'বন্ধ'}
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border p-3 text-center">
                  <ShoppingCart className="mx-auto mb-1 h-4 w-4 text-primary" />
                  <div className="text-lg font-extrabold">{toBn(viewTarget.orderCount)}</div>
                  <div className="text-[11px] text-muted-foreground">মোট অর্ডার</div>
                </div>
                <div className="rounded-xl border p-3 text-center">
                  <Wallet className="mx-auto mb-1 h-4 w-4 text-primary" />
                  <div className="text-lg font-extrabold">{formatBDT(viewTarget.totalSpent)}</div>
                  <div className="text-[11px] text-muted-foreground">মোট খরচ</div>
                </div>
                <div className="rounded-xl border p-3 text-center">
                  <CalendarDays className="mx-auto mb-1 h-4 w-4 text-primary" />
                  <div className="text-sm font-bold leading-tight mt-1.5">{formatBnDate(viewTarget.createdAt)}</div>
                  <div className="text-[11px] text-muted-foreground">সদস্য হয়েছেন</div>
                </div>
              </div>

              {/* Group + note editor */}
              <div className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-bold"><StickyNote className="h-4 w-4 text-primary" /> গ্রুপ ও অ্যাডমিন নোট</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>কাস্টমার গ্রুপ</Label>
                    <Select value={groupDraft} onValueChange={setGroupDraft}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">রেগুলার</SelectItem>
                        <SelectItem value="vip">ভিআইপি</SelectItem>
                        <SelectItem value="wholesale">হোলসেল</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>নোট (শুধু অ্যাডমিন দেখবে)</Label>
                    <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} placeholder="যেমন: বাল্ক অর্ডার নেন প্রতি মাসে" className="mt-1.5" />
                  </div>
                </div>
                <Button size="sm" className="mt-3 font-semibold" onClick={saveGroupNote} disabled={savingNote}>সেভ করুন</Button>
              </div>

              <Separator />

              {/* Order history */}
              <div>
                <div className="mb-2 text-sm font-bold">অর্ডার হিস্ট্রি ({toBn(detailOrders.length)})</div>
                {detailOrders.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">এই কাস্টমারের কোনো অর্ডার নেই</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {detailOrders.map((o) => (
                      <div key={o.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                        <span className="font-mono font-semibold">{o.orderNumber}</span>
                        <Badge className={cn('text-[10px]', ORDER_STATUS_COLOR[o.status])}>{ORDER_STATUS_BN[o.status] || o.status}</Badge>
                        <span className="ml-auto font-bold">{formatBDT(o.total)}</span>
                        <span className="text-muted-foreground">{formatBnDate(o.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Addresses */}
              <div>
                <div className="mb-2 text-sm font-bold">ঠিকানা ({toBn(detailAddresses.length)})</div>
                {detailAddresses.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">কোনো ঠিকানা সেভ করা নেই</p>
                ) : (
                  <div className="space-y-2">
                    {detailAddresses.map((a) => (
                      <div key={a.id} className="rounded-lg border p-2.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{a.label || 'ঠিকানা'} — {a.name}</span>
                          {a.isDefaultShipping && <Badge variant="secondary" className="text-[10px]">ডিফল্ট</Badge>}
                        </div>
                        <div className="mt-0.5 text-muted-foreground">{a.phone} • {a.fullAddress}, {a.area ? `${a.area}, ` : ''}{a.city}, {a.district}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, ShieldCheck, Users, ScrollText, Search, Download,
  Ban, CheckCircle2, Lock, AlertTriangle, Loader2, UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { saveRole, deleteRole, updateUserAccess, downloadCSV } from '@/lib/db/services';
import { createStaff } from '@/lib/db/auth';
import { PERMISSIONS } from '@/lib/db/types';
import type { Role, Permission, User } from '@/lib/db/types';
import { toBn, formatBnDate } from '@/lib/types';
import { cn } from '@/lib/utils';

// ───────────────────────────── পারমিশন গ্রুপিং ─────────────────────────────

const GROUP_LABELS: Record<string, string> = {
  dashboard: 'ড্যাশবোর্ড',
  products: 'পণ্য',
  categories: 'ক্যাটাগরি',
  brands: 'ব্র্যান্ড',
  orders: 'অর্ডার',
  payments: 'পেমেন্ট',
  customers: 'কাস্টমার',
  coupons: 'কুপন',
  marketing: 'মার্কেটিং',
  delivery: 'ডেলিভারি',
  couriers: 'কুরিয়ার',
  content: 'কনটেন্ট',
  cms: 'CMS পেজ',
  seo: 'SEO',
  reports: 'রিপোর্ট',
  expenses: 'খরচ',
  roles: 'রোল',
  staff: 'স্টাফ',
  settings: 'সেটিংস',
  audit: 'অডিট',
  backup: 'ব্যাকআপ',
  system: 'সিস্টেম',
};

const PERM_ACTION_LABELS: Record<string, string> = {
  view: 'দেখা',
  create: 'তৈরি',
  edit: 'সম্পাদনা',
  delete: 'ডিলিট',
  import: 'ইমপোর্ট',
  export: 'এক্সপোর্ট',
  manage: 'পরিচালনা',
  cancel: 'বাতিল',
  refund: 'রিফান্ড',
  verify: 'ভেরিফাই',
};

const PERM_GROUPS: { key: string; label: string; perms: Permission[] }[] = (() => {
  const map = new Map<string, Permission[]>();
  for (const p of PERMISSIONS) {
    const g = p.split('.')[0];
    const list = map.get(g) || [];
    list.push(p);
    map.set(g, list);
  }
  return [...map.entries()].map(([key, perms]) => ({ key, label: GROUP_LABELS[key] || key, perms }));
})();

function permLabel(p: Permission): string {
  const action = p.split('.')[1] || p;
  return PERM_ACTION_LABELS[action] || action;
}

// ───────────────────────────── রোল ট্যাব ─────────────────────────────

type RoleForm = {
  id: string;
  name: string;
  nameBn: string;
  perms: Set<string>;
  isSystem: boolean;
};

function RolesTab() {
  const { toast } = useToast();
  const roles = useCollection('roles');
  const users = useCollection('users');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleForm>({ id: '', name: '', nameBn: '', perms: new Set(), isSystem: false });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const userCountByRole = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of users) map.set(u.roleId, (map.get(u.roleId) || 0) + 1);
    return map;
  }, [users]);

  const openCreate = () => {
    setEditing(null);
    setForm({ id: uid('role_'), name: '', nameBn: '', perms: new Set(['dashboard.view']), isSystem: false });
    setDialogOpen(true);
  };

  const openEdit = (r: Role) => {
    setEditing(r);
    setForm({ id: r.id, name: r.name, nameBn: r.nameBn, perms: new Set<string>(Array.isArray(r.permissions) ? r.permissions : []), isSystem: r.isSystem });
    setDialogOpen(true);
  };

  const togglePerm = (p: Permission) => {
    if (form.id === 'super_admin') return;
    setForm((prev) => {
      const next = new Set(prev.perms);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return { ...prev, perms: next };
    });
  };

  const toggleGroup = (perms: Permission[]) => {
    if (form.id === 'super_admin') return;
    setForm((prev) => {
      const next = new Set(prev.perms);
      const allSelected = perms.every((p) => next.has(p));
      for (const p of perms) {
        if (allSelected) next.delete(p);
        else next.add(p);
      }
      return { ...prev, perms: next };
    });
  };

  const save = () => {
    if (!form.name.trim() || !form.nameBn.trim()) {
      toast({ title: 'রোলের নাম (ইংরেজি ও বাংলা) দিন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const role = {
        id: form.id,
        name: form.name.trim(),
        nameBn: form.nameBn.trim(),
        permissions: PERMISSIONS.filter((p) => form.perms.has(p)),
        isSystem: editing?.isSystem ?? false,
      };
      const res = saveRole(role);
      if (res.ok) {
        toast({ title: editing ? 'রোল আপডেট হয়েছে' : 'নতুন রোল তৈরি হয়েছে' });
        setDialogOpen(false);
      } else {
        toast({ title: 'সমস্যা হয়েছে', description: res.error, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const res = deleteRole(deleteTarget.id);
    if (res.ok) {
      toast({ title: 'রোল মুছে ফেলা হয়েছে' });
    } else {
      toast({ title: 'মুছতে ব্যর্থ', description: res.error, variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  const isSuper = form.id === 'super_admin';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">রোল অনুযায়ী স্টাফ কী কী করতে পারবে তা নিয়ন্ত্রণ করুন</p>
        <Button onClick={openCreate} size="sm" className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন রোল
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((r) => (
          <div key={r.id} className={cn('rounded-xl border bg-card p-3', r.id === 'super_admin' && 'border-primary/40 bg-primary/5')}>
            <div className="flex items-start gap-2">
              <ShieldCheck className={cn('mt-0.5 h-4 w-4 shrink-0', r.id === 'super_admin' ? 'text-primary' : 'text-muted-foreground')} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">{r.nameBn}</span>
                  <span className="text-xs text-muted-foreground">({r.name})</span>
                  {r.isSystem && (
                    <Badge variant="outline" className="gap-1 text-[9px]"><Lock className="h-2.5 w-2.5" /> সিস্টেম</Badge>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <Users className="mr-1 inline h-3 w-3" />{toBn(userCountByRole.get(r.id) || 0)} জন ইউজার • {toBn((Array.isArray(r.permissions) ? r.permissions : []).length)}টি পারমিশন
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} aria-label="সম্পাদনা">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!r.isSystem && (
                  <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(r)} aria-label="মুছুন">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Role dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'রোল সম্পাদনা' : 'নতুন রোল'}</DialogTitle>
            <DialogDescription>পারমিশন ম্যাট্রিক্স থেকে অনুমতি বাছাই করুন</DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            পরিবর্তন তৎক্ষণাৎ কার্যকর হবে — এই রোলের সব স্টাফ সাথে সাথে নতুন অনুমতি পাবে/হারাবে।
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>নাম (ইংরেজি) <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Inventory Manager" className="mt-1.5" />
            </div>
            <div>
              <Label>নাম (বাংলা) <span className="text-destructive">*</span></Label>
              <Input value={form.nameBn} onChange={(e) => setForm({ ...form, nameBn: e.target.value })} placeholder="ইনভেন্টরি ম্যানেজার" className="mt-1.5" />
            </div>
          </div>

          {isSuper && (
            <p className="rounded-lg bg-primary/10 p-2.5 text-xs font-medium text-primary">
              সুপার অ্যাডমিন সম্পূর্ণ ক্ষমতাধর — পারমিশন পরিবর্তন করা যাবে না।
            </p>
          )}

          <div className={cn('space-y-3', isSuper && 'pointer-events-none opacity-60')}>
            {PERM_GROUPS.map((g) => {
              const allSelected = g.perms.every((p) => form.perms.has(p));
              return (
                <div key={g.key} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{g.label}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => toggleGroup(g.perms)}>
                      <Checkbox checked={allSelected} className="h-3 w-3" tabIndex={-1} aria-hidden="true" />
                      সব বাছাই
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    {g.perms.map((p) => (
                      <label key={p} className="flex cursor-pointer items-center gap-2 text-xs" title={p}>
                        <Checkbox checked={form.perms.has(p)} onCheckedChange={() => togglePerm(p)} />
                        <span className="truncate">{permLabel(p)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
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
            <AlertDialogTitle>রোলটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{deleteTarget?.nameBn}&quot; স্থায়ীভাবে মুছে যাবে। এই রোলে ইউজার থাকলে মুছা যাবে না।</AlertDialogDescription>
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

// ───────────────────────────── স্টাফ ট্যাব ─────────────────────────────

function StaffTab() {
  const { toast } = useToast();
  const users = useCollection('users');
  const roles = useCollection('roles');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: 'admin' });
  const [saving, setSaving] = useState(false);

  const staff = users.filter((u) => u.roleId !== 'customer');
  const adminRoles = roles.filter((r) => r.id !== 'customer');
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast({ title: 'নাম, ইমেইল ও পাসওয়ার্ড দিন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await createStaff({ name: form.name.trim(), email: form.email.trim(), password: form.password, roleId: form.roleId });
      if (res.ok) {
        toast({ title: 'স্টাফ তৈরি হয়েছে', description: `${form.email.trim()} — Firebase Auth অ্যাকাউন্টসহ` });
        setForm({ name: '', email: '', password: '', roleId: 'admin' });
        setCreateOpen(false);
      } else {
        toast({ title: 'তৈরি করা যায়নি', description: res.error, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const changeRole = (u: User, roleId: string) => {
    const res = updateUserAccess(u.id, { roleId });
    if (res.ok) toast({ title: 'রোল পরিবর্তন হয়েছে', description: `${u.name} → ${roleMap.get(roleId)?.nameBn || roleId}` });
    else toast({ title: 'রোল বদলানো যায়নি', description: res.error, variant: 'destructive' });
  };

  const toggleStatus = (u: User) => {
    const next = u.status === 'active' ? 'suspended' : 'active';
    const res = updateUserAccess(u.id, { status: next });
    if (res.ok) toast({ title: next === 'active' ? 'স্টাফ সক্রিয় করা হয়েছে' : 'স্টাফ সাসপেন্ড করা হয়েছে' });
    else toast({ title: 'সমস্যা হয়েছে', description: res.error, variant: 'destructive' });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">অ্যাডমিন প্যানেলে লগইন করতে পারে এমন স্টাফদের তালিকা</p>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" /> নতুন স্টাফ
        </Button>
      </div>

      {staff.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <UserCog className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো স্টাফ নেই</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map((u) => (
            <div key={u.id} className={cn('flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3', u.status === 'suspended' && 'opacity-60')}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-bold text-primary">
                {(u.name || '?').trim().charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold">{u.name}</span>
                  <Badge variant={roleMap.get(u.roleId)?.id === 'super_admin' ? 'default' : 'secondary'} className="text-[10px]">
                    {roleMap.get(u.roleId)?.nameBn || u.roleId}
                  </Badge>
                  <Badge className={u.status === 'active' ? 'bg-emerald-100 text-emerald-800 text-[10px] dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 text-[10px] dark:bg-red-950 dark:text-red-300'}>
                    {u.status === 'active' ? 'সক্রিয়' : 'বন্ধ'}
                  </Badge>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.email || '—'} • শেষ লগইন: {u.lastLoginAt ? formatBnDate(u.lastLoginAt) : 'কখনো নেই'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Select value={u.roleId} onValueChange={(v) => changeRole(u, v)}>
                  <SelectTrigger className="h-8 w-36 text-xs" aria-label="রোল পরিবর্তন"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {adminRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nameBn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn('h-8 w-8', u.status === 'active' ? 'text-destructive hover:bg-destructive/10' : 'text-emerald-600 hover:bg-emerald-500/10')}
                  onClick={() => toggleStatus(u)}
                  aria-label={u.status === 'active' ? 'সাসপেন্ড করুন' : 'সক্রিয় করুন'}
                >
                  {u.status === 'active' ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create staff dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>নতুন স্টাফ তৈরি</DialogTitle>
            <DialogDescription>ইমেইল + পাসওয়ার্ড দিয়ে অ্যাডমিন প্যানেলে লগইন করতে পারবে</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>নাম <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="করিম উদ্দিন" className="mt-1.5" />
            </div>
            <div>
              <Label>ইমেইল <span className="text-destructive">*</span></Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@theshopbd.com" className="mt-1.5" />
            </div>
            <div>
              <Label>পাসওয়ার্ড <span className="text-destructive">*</span></Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="কমপক্ষে ৬ অক্ষর" className="mt-1.5" />
            </div>
            <div>
              <Label>রোল</Label>
              <Select value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {adminRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nameBn} ({r.name})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>বাতিল</Button>
            <Button className="flex-1 font-semibold" onClick={create} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> তৈরি হচ্ছে...</> : 'তৈরি করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────────────────────── অডিট ট্যাব ─────────────────────────────

function AuditTab() {
  const { toast } = useToast();
  const logs = useCollection('auditLogs');
  const [actionPrefix, setActionPrefix] = useState('');
  const [actor, setActor] = useState('');

  const filtered = useMemo(() => {
    const prefix = actionPrefix.trim().toLowerCase();
    const act = actor.trim().toLowerCase();
    return logs.filter((l) => {
      if (prefix && !l.action.toLowerCase().startsWith(prefix)) return false;
      if (act && !l.actor.toLowerCase().includes(act)) return false;
      return true;
    });
  }, [logs, actionPrefix, actor]);

  const exportCsv = () => {
    downloadCSV(
      'audit-logs.csv',
      filtered.map((l) => ({
        সময়: formatBnDate(l.createdAt),
        অ্যাক্টর: l.actor,
        অ্যাকশন: l.action,
        এন্টিটি: l.entity,
        আইডি: l.entityId || '',
        বিবরণ: l.details || '',
      })),
    );
    toast({ title: 'CSV ডাউনলোড হয়েছে' });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={actionPrefix} onChange={(e) => setActionPrefix(e.target.value)} placeholder="অ্যাকশন প্রিফিক্স (যেমন: order.)" className="pl-9 font-mono text-xs" />
        </div>
        <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="অ্যাক্টর" className="w-full sm:w-44" />
        <Button variant="outline" size="sm" className="gap-1.5 font-semibold" onClick={exportCsv}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
          <ScrollText className="mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">কোনো অডিট লগ পাওয়া যায়নি</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[480px] rounded-xl border bg-card">
          <div className="divide-y">
            {filtered.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-xs">
                <span className="shrink-0 text-muted-foreground">{formatBnDate(l.createdAt)}</span>
                <span className="shrink-0 font-semibold">{l.actor}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-primary">{l.action}</code>
                <span className="text-muted-foreground">{l.entity}{l.entityId ? `: ${l.entityId}` : ''}</span>
                {l.details && <span className="min-w-0 flex-1 truncate text-muted-foreground">— {l.details}</span>}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ───────────────────────────── মূল সেকশন ─────────────────────────────

export function AdminRoles() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">রোল ও পারমিশন</h2>
        <p className="text-xs text-muted-foreground">স্টাফ পরিচালনা, রোল-ভিত্তিক অনুমতি ও অডিট ট্রেইল</p>
      </div>
      <Tabs defaultValue="roles" className="gap-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="roles" className="gap-1.5"><ShieldCheck className="h-4 w-4" /> রোল ও পারমিশন</TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5"><Users className="h-4 w-4" /> স্টাফ</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="h-4 w-4" /> অডিট লগ</TabsTrigger>
        </TabsList>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}

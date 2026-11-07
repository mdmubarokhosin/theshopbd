'use client';

/**
 * অ্যাডমিন গেট — Firebase ভিত্তিক বুটস্ট্র্যাপ
 * ---------------------------------------------------------------------------
 * • Firebase/RTDB-তে কোনো অ্যাডমিন না থাকলে → রেজিস্ট্রেশন ফর্ম খোলে,
 *   প্রথম রেজিস্ট্রেশনকারী অটোমেটিক সুপার অ্যাডমিন হয়ে যায়
 * • অ্যাডমিন থাকলে → লগইন ফর্ম খোলে
 * • ক্লাউড ডেটা আসা পর্যন্ত (সর্বোচ্চ ~৮ সেকেন্ড) যাচাই স্পিনার দেখানো হয় —
 *   যেন নতুন ডিভাইসে ভুল করে দ্বিতীয় অ্যাডমিন তৈরি না হয়
 */

import { useEffect, useState } from 'react';
import {
  Lock, LogIn, Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff, UserPlus,
  CloudCog, CheckCircle2, XCircle, Globe, KeyRound, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminExists, loginAdmin, registerFirstAdmin } from '@/lib/db/auth';
import { waitForCloudReady, getCloudState, subscribeCloud, type CloudState } from '@/lib/db/cloud';
import { notifyAuthChanged } from '@/lib/db/hooks';
import { firebaseErrorMessage } from '@/lib/firebase/app';

function CloudBadge() {
  const [state, setState] = useState<CloudState>(() => getCloudState());
  useEffect(() => subscribeCloud(() => setState(getCloudState())), []);
  const map = {
    online: { icon: CheckCircle2, cls: 'text-emerald-600', label: 'Firebase সংযুক্ত' },
    connecting: { icon: CloudCog, cls: 'text-amber-600 animate-pulse', label: 'Firebase সংযোগ হচ্ছে...' },
    offline: { icon: CloudCog, cls: 'text-amber-600', label: 'অফলাইন — স্থানীয় ডেটা' },
    error: { icon: XCircle, cls: 'text-destructive', label: 'Firebase সমস্যা' },
  } as const;
  const m = map[state.status];
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-medium">
      <m.icon className={`h-3.5 w-3.5 ${m.cls}`} />
      <span className="text-muted-foreground">{m.label}</span>
      {state.status === 'error' && state.error && (
        <span className="min-w-0 max-w-full break-words text-destructive">— {state.error.slice(0, 60)}</span>
      )}
    </div>
  );
}

/** ক্লাউড রেডি হওয়া পর্যন্ত অপেক্ষা করে তারপর লগইন/রেজিস্ট্রেশন ঠিক করে */
export function AdminGate({ onBack }: { onBack: () => void }) {
  const [checking, setChecking] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    void waitForCloudReady(8000).then(() => {
      if (!alive) return;
      setHasAdmin(adminExists());
      setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 via-background to-primary/10">
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> দোকানে ফিরে যান
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-16">
          <ShieldCheck className="h-10 w-10 animate-pulse text-primary" />
          <p className="text-sm font-medium">Firebase থেকে অ্যাডমিন তথ্য যাচাই হচ্ছে...</p>
          <CloudBadge />
        </div>
      </div>
    );
  }

  return hasAdmin ? <AdminLogin onBack={onBack} /> : <AdminRegister onBack={onBack} />;
}

function AdminShell({
  onBack,
  title,
  subtitle,
  icon,
  children,
}: {
  onBack: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 via-background to-primary/10">
      <div className="p-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> দোকানে ফিরে যান
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              {icon}
            </div>
            <h1 className="text-2xl font-extrabold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <div className="mt-4">
            <CloudBadge />
          </div>
        </div>
      </div>
    </div>
  );
}

/** লগইন ফর্ম — অ্যাডমিন ইতিমধ্যে থাকলে এটাই দেখাবে */
export function AdminLogin({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('ইমেইল ও পাসওয়ার্ড দিন');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await loginAdmin(email.trim(), password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'লগইন ব্যর্থ হয়েছে');
      return;
    }
    notifyAuthChanged();
  };

  return (
    <AdminShell
      onBack={onBack}
      title="অ্যাডমিন প্যানেল"
      subtitle="অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন"
      icon={<ShieldCheck className="h-8 w-8 text-primary-foreground" />}
    >
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div>
          <Label htmlFor="admin-email">ইমেইল</Label>
          <div className="relative mt-1.5">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-email"
              type="email"
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="admin-password">পাসওয়ার্ড</Label>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              className="pl-9 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="পাসওয়ার্ড লিখুন"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full font-bold" size="lg" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> লগইন হচ্ছে...</>
          ) : (
            <><LogIn className="mr-2 h-4 w-4" /> লগইন করুন</>
          )}
        </Button>

        <p className="text-center text-[11px] leading-snug text-muted-foreground">
          সুরক্ষা নোট: অ্যাডমিন অ্যাকাউন্ট Firebase Authentication-এ সংরক্ষিত — কোনো ক্রেডেনশিয়াল কোডে রাখা হয় না।
        </p>
      </form>
    </AdminShell>
  );
}

/** রেজিস্ট্রেশন ফর্ম — একদম প্রথম অ্যাডমিন তৈরির জন্য */
function AdminRegister({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('আপনার নাম লিখুন'); return; }
    if (!email.trim()) { setError('ইমেইল দিন'); return; }
    if (password.length < 6) { setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'); return; }
    if (password !== confirm) { setError('দুটি পাসওয়ার্ড মিলছে না'); return; }
    setLoading(true);
    setError(null);
    const res = await registerFirstAdmin({ name: name.trim(), email: email.trim(), password });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || firebaseErrorMessage(res));
      return;
    }
    notifyAuthChanged();
  };

  return (
    <AdminShell
      onBack={onBack}
      title="প্রথম অ্যাডমিন সেটআপ"
      subtitle="ডাটাবেজে কোনো অ্যাডমিন নেই — রেজিস্ট্রেশন করলেই আপনি অটোমেটিক সুপার অ্যাডমিন হবেন"
      icon={<UserPlus className="h-8 w-8 text-primary-foreground" />}
    >
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
            এটি একমাত্র সময় যখন রেজিস্ট্রেশন ফর্ম দেখা যাবে। প্রথম অ্যাডমিন তৈরি হওয়ার পর এই URL-এ শুধু লগইন ফর্মই দেখাবে।
          </p>
        </div>

        <div>
          <Label htmlFor="admin-reg-name">পুরো নাম</Label>
          <div className="relative mt-1.5">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="admin-reg-name" className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার নাম" />
          </div>
        </div>
        <div>
          <Label htmlFor="admin-reg-email">ইমেইল</Label>
          <div className="relative mt-1.5">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="admin-reg-email" type="email" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" autoComplete="username" />
          </div>
        </div>
        <div>
          <Label htmlFor="admin-reg-pass">পাসওয়ার্ড</Label>
          <div className="relative mt-1.5">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-reg-pass"
              type={showPassword ? 'text' : 'password'}
              className="pl-9 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="কমপক্ষে ৬ অক্ষর"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="admin-reg-confirm">পাসওয়ার্ড নিশ্চিত</Label>
          <Input
            id="admin-reg-confirm"
            type="password"
            className="mt-1.5"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="আবার লিখুন"
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full font-bold" size="lg" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> অ্যাকাউন্ট তৈরি হচ্ছে...</>
          ) : (
            <><UserPlus className="mr-2 h-4 w-4" /> অ্যাডমিন হিসেবে রেজিস্ট্রেশন করুন</>
          )}
        </Button>

        <p className="text-center text-[11px] leading-snug text-muted-foreground">
          অ্যাকাউন্টটি Firebase Authentication-এ তৈরি হবে এবং অ্যাডমিন তথ্য Realtime Database-এ সংরক্ষিত হবে।
        </p>
      </form>
    </AdminShell>
  );
}

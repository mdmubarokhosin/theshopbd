'use client';

/**
 * লগইন ও রেজিস্ট্রেশন — Firebase Authentication
 * ---------------------------------------------------------------------------
 * • Sign-in providers: Google (প্রোফাইল অটো-ফিল: নাম, ইমেইল, ছবি) + Email/Password
 * • পাসওয়ার্ড ভুলে গেলে Firebase থেকে রিয়েল রিসেট ইমেইল যায়
 */

import { useEffect, useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, ChevronLeft, User, Smartphone, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Logo } from './logo';
import { useStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { useCurrentUser, notifyAuthChanged } from '@/lib/db/hooks';
import {
  loginWithEmail, registerWithEmail, sendResetEmail, signInWithGoogle,
} from '@/lib/db/auth';

type Mode = 'login' | 'register';
type Flow = 'none' | 'forgot';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Google অফিসিয়াল মাল্টিকালার লোগো */
function GoogleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

export function AuthView({ initialMode }: { initialMode?: 'login' | 'register' }) {
  const navigate = useStore((s) => s.navigate);
  const siteSettings = useStore((s) => s.siteSettings);
  const { user, ready } = useCurrentUser();

  const [mode, setMode] = useState<Mode>(initialMode === 'register' ? 'register' : 'login');
  const [flow, setFlow] = useState<Flow>('none');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // লগইন
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // ফরগট পাসওয়ার্ড
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // রেজিস্ট্রেশন
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [newsletter, setNewsletter] = useState(true);
  // রেফারেল কোড — URL ?ref= থাকলে প্রি-ফিল (রেন্ডার-টাইম অ্যাডজাস্ট — hydration-safe)
  const [refCode, setRefCode] = useState('');
  const [refSynced, setRefSynced] = useState(false);
  if (!refSynced) {
    setRefSynced(true);
    if (typeof window !== 'undefined') {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref) setRefCode(ref.toUpperCase());
    }
  }

  // লগইন থাকলে অ্যাকাউন্টে পাঠান
  useEffect(() => {
    if (ready && user) navigate({ name: 'account' });
  }, [ready, user, navigate]);

  const afterAuth = (name?: string | null) => {
    notifyAuthChanged();
    toast({ title: 'স্বাগতম!', description: name ? `${name}, আপনি সফলভাবে লগইন করেছেন` : 'লগইন সফল হয়েছে' });
    navigate({ name: 'account' });
  };

  const doGoogle = async () => {
    setGoogleBusy(true);
    const res = await signInWithGoogle();
    setGoogleBusy(false);
    if (res.ok) {
      afterAuth(res.user?.name);
    } else {
      toast({ title: 'Google লগইন ব্যর্থ হয়েছে', description: res.error, variant: 'destructive' });
    }
  };

  const doLogin = async () => {
    if (!email.trim()) return toast({ title: 'ইমেইল দিন', variant: 'destructive' });
    if (!password) return toast({ title: 'পাসওয়ার্ড দিন', variant: 'destructive' });
    setBusy(true);
    const res = await loginWithEmail(email.trim(), password);
    setBusy(false);
    if (res.ok) {
      afterAuth(res.user?.name);
    } else {
      toast({ title: 'লগইন ব্যর্থ হয়েছে', description: res.error, variant: 'destructive' });
    }
  };

  const doRegister = async () => {
    if (!regName.trim()) return toast({ title: 'আপনার নাম লিখুন', variant: 'destructive' });
    if (!EMAIL_RE.test(regEmail.trim())) return toast({ title: 'সঠিক ইমেইল দিন', variant: 'destructive' });
    if (regPass.length < 6) return toast({ title: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', variant: 'destructive' });
    if (regPass !== regConfirm) return toast({ title: 'দুটি পাসওয়ার্ড মিলছে না', variant: 'destructive' });
    setBusy(true);
    const res = await registerWithEmail({
      name: regName.trim(),
      email: regEmail.trim(),
      phone: regPhone.trim() || undefined,
      password: regPass,
      newsletter,
      refCode: refCode.trim() || undefined,
    });
    setBusy(false);
    if (res.ok) {
      afterAuth(res.user?.name);
    } else {
      toast({ title: 'রেজিস্ট্রেশন ব্যর্থ হয়েছে', description: res.error, variant: 'destructive' });
    }
  };

  const doForgot = async () => {
    if (!EMAIL_RE.test(forgotEmail.trim())) {
      toast({ title: 'সঠিক ইমেইল দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const res = await sendResetEmail(forgotEmail.trim());
    setBusy(false);
    if (res.ok) {
      setForgotSent(true);
      toast({ title: 'রিসেট ইমেইল পাঠানো হয়েছে', description: 'ইনবক্স (ও স্প্যাম ফোল্ডার) দেখুন' });
    } else {
      toast({ title: 'ইমেইল পাঠানো যায়নি', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo />
          <p className="text-center text-sm text-muted-foreground">
            লগইন করে অর্ডার ট্র্যাক, উইশলিস্ট ও দ্রুত চেকআউট উপভোগ করুন
          </p>
        </div>

        {flow === 'none' ? (
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="mb-5 grid w-full grid-cols-2">
                <TabsTrigger value="login">লগইন</TabsTrigger>
                <TabsTrigger value="register">রেজিস্ট্রেশন</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Google Sign-in — লগইন ও রেজিস্ট্রেশন দুই ট্যাবেই */}
            <Button
              type="button"
              variant="outline"
              className="mb-4 w-full gap-2.5 font-semibold"
              size="lg"
              onClick={doGoogle}
              disabled={googleBusy || busy}
            >
              {googleBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon className="h-4.5 w-4.5" />
              )}
              Google দিয়ে {mode === 'login' ? 'লগইন করুন' : 'রেজিস্ট্রেশন করুন'}
            </Button>

            <div className="mb-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium text-muted-foreground">অথবা ইমেইল দিয়ে</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {mode === 'login' ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="auth-id">ইমেইল</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="auth-id"
                      type="email"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                      placeholder="you@email.com"
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="auth-pass">পাসওয়ার্ড</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="auth-pass"
                      className="pl-9 pr-10"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                      placeholder="আপনার পাসওয়ার্ড"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPass ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button className="w-full font-semibold" onClick={doLogin} disabled={busy || googleBusy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} লগইন করুন
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setFlow('forgot');
                  }}
                  className="mx-auto block text-sm font-medium text-primary hover:underline"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="reg-name">পুরো নাম</Label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reg-name" className="pl-9" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="আপনার নাম" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reg-email">ইমেইল</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      className="pl-9"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reg-phone">
                    মোবাইল নম্বর <span className="font-normal text-muted-foreground">(ঐচ্ছিক — অর্ডার আপডেটের জন্য)</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-phone"
                      inputMode="numeric"
                      maxLength={11}
                      className="pl-9"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="01XXXXXXXXX"
                      aria-label="মোবাইল নম্বর"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="reg-pass">পাসওয়ার্ড</Label>
                    <Input
                      id="reg-pass"
                      className="mt-1.5"
                      type="password"
                      value={regPass}
                      onChange={(e) => setRegPass(e.target.value)}
                      placeholder="কমপক্ষে ৬ অক্ষর"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-confirm">পাসওয়ার্ড নিশ্চিত</Label>
                    <Input
                      id="reg-confirm"
                      className="mt-1.5"
                      type="password"
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      placeholder="আবার লিখুন"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="newsletter" checked={newsletter} onCheckedChange={(v) => setNewsletter(v === true)} />
                  <Label htmlFor="newsletter" className="cursor-pointer text-sm font-normal">
                    অফার ও নিউজলেটার পেতে চাই
                  </Label>
                </div>

                <div>
                  <Label htmlFor="reg-ref">রেফারেল কোড (ঐচ্ছিক)</Label>
                  <Input
                    id="reg-ref"
                    className="mt-1.5 uppercase"
                    value={refCode}
                    onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                    placeholder="বন্ধুর কোড থাকলে দিন (যেমন: TSB-AB12CD)"
                  />
                </div>

                <Button className="w-full font-semibold" onClick={doRegister} disabled={busy || googleBusy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} অ্যাকাউন্ট তৈরি করুন
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  অ্যাকাউন্ট তৈরির মাধ্যমে আপনি আমাদের{' '}
                  <button className="text-primary hover:underline" onClick={() => navigate({ name: 'info', page: 'terms' })}>
                    শর্তাবলী
                  </button>{' '}
                  ও{' '}
                  <button className="text-primary hover:underline" onClick={() => navigate({ name: 'info', page: 'privacy' })}>
                    প্রাইভেসি পলিসি
                  </button>
                  -তে সম্মত হচ্ছেন
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <button
              type="button"
              onClick={() => setFlow('none')}
              className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> লগইনে ফিরুন
            </button>
            <h2 className="text-lg font-bold">পাসওয়ার্ড রিসেট</h2>
            <p className="mt-1 text-sm text-muted-foreground">অ্যাকাউন্টের ইমেইল দিন — Firebase নিরাপদ রিসেট ইমেইল পাঠাবে</p>
            <div className="mt-4">
              <Label htmlFor="forgot-email">ইমেইল</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  type="email"
                  className="pl-9"
                  value={forgotEmail}
                  onChange={(e) => {
                    setForgotEmail(e.target.value);
                    setForgotSent(false);
                  }}
                  placeholder="you@email.com"
                />
              </div>
            </div>
            <Button className="mt-4 w-full font-semibold" onClick={doForgot} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              রিসেট ইমেইল পাঠান
            </Button>
            {forgotSent && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                ইমেইল পাঠানো হয়েছে ✓ — ইনবক্সে না পেলে স্প্যাম ফোল্ডার দেখুন।
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {siteSettings.contact_phone
            ? `সমস্যা হলে হেল্পলাইনে কল করুন: ${siteSettings.contact_phone}`
            : 'সমস্যা হলে যোগাযোগ পেজ থেকে আমাদের জানান'}
        </p>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { AppShell } from '@/components/store/app-shell';
import { spString } from '@/lib/nav';

export const metadata: Metadata = {
  title: 'লগইন / রেজিস্ট্রেশন — THE SHOP BD',
  description: 'THE SHOP BD অ্যাকাউন্টে লগইন করুন বা নতুন অ্যাকাউন্ট খুলুন — OTP দিয়ে দ্রুত ও নিরাপদ।',
  alternates: { canonical: '/login' },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <AppShell view={{ name: 'auth', mode: spString(sp.mode) === 'register' ? 'register' : 'login' }} />;
}

'use client';

/**
 * /pay/sslcz-return — SSLCommerz কলব্যাক পেজ
 * ---------------------------------------------------------------------------
 * SSLCommerz success/fail/cancel URL এখানে ফেরত আসে
 * (?status=success&order=TS-..&val_id=..)। সার্ভার ভ্যালিডেশনের পর অর্ডার PAID হয়।
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db/core';
import { markCartRecovered } from '@/lib/db/growth';

function SslczReturnInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<'working' | 'ok' | 'fail'>('working');
  const [message, setMessage] = useState('পেমেন্ট যাচাই হচ্ছে...');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const status = params.get('status') || '';
    const orderNumber = params.get('order') || '';
    const valId = params.get('val_id') || '';

    const fail = (msg: string) => {
      setState('fail');
      setMessage(msg);
    };

    if (!orderNumber) {
      fail('কলব্যাক তথ্য অসম্পূর্ণ');
      return;
    }
    if (status !== 'success' && status !== 'ipn') {
      fail(status === 'cancel' ? 'আপনি পেমেন্ট বাতিল করেছেন' : 'পেমেন্ট সম্পন্ন হয়নি — অর্ডারটি পেন্ডিং আছে');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/pay/sslcz/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ val_id: valId, orderNumber }),
        });
        const data = (await res.json()) as { ok?: boolean; valid?: boolean; amount?: number | null };
        if (data.valid) {
          const order = db.collection('orders').find((o) => o.orderNumber === orderNumber);
          if (order) {
            const now = new Date().toISOString();
            db.put('orders', {
              ...order,
              paymentStatus: 'PAID',
              status: 'CONFIRMED',
              transaction: { ...(order.transaction ?? {}), trxId: valId || null, verifiedAt: now, verifiedBy: 'sslcommerz' },
              statusHistory: [...order.statusHistory, { status: 'CONFIRMED', at: now, note: 'SSLCommerz পেমেন্ট ভেরিফাইড', by: 'sslcommerz' }],
              updatedAt: now,
            });
            markCartRecovered();
          }
          setState('ok');
          setMessage('পেমেন্ট সফল ও ভেরিফাইড হয়েছে!');
          setTimeout(() => router.replace(`/order-success?order=${encodeURIComponent(orderNumber)}`), 1600);
        } else {
          fail('পেমেন্ট ভেরিফিকেশন ব্যর্থ — টাকা কাটলে ২৪ ঘণ্টার মধ্যে ফেরত যাবে');
        }
      } catch {
        fail('সংযোগ সমস্যা — কিছুক্ষণ পরে অর্ডার স্ট্যাটাস দেখুন');
      }
    })();
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center">
        {state === 'working' && <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
        {state === 'ok' && <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />}
        {state === 'fail' && <XCircle className="mx-auto h-10 w-10 text-destructive" />}
        <h1 className="mt-4 text-lg font-bold">অনলাইন পেমেন্ট</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {state === 'fail' && (
          <Button className="mt-5 w-full" onClick={() => router.replace('/')}>হোমপেজে ফিরুন</Button>
        )}
      </div>
    </div>
  );
}

export default function SslczReturnPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SslczReturnInner />
    </Suspense>
  );
}

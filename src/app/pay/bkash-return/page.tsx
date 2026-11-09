'use client';

/**
 * /pay/bkash-return — bKash কলব্যাক পেজ
 * ---------------------------------------------------------------------------
 * bKash পেমেন্ট শেষে এখানে ফেরত আসে (?paymentID=..&status=..&order=..)।
 * এক্সিকিউট করে সফল হলে অর্ডার PAID করে → /order-success।
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db/core';
import { markCartRecovered } from '@/lib/db/growth';

function BkashReturnInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<'working' | 'ok' | 'fail'>('working');
  const [message, setMessage] = useState('bKash পেমেন্ট যাচাই হচ্ছে...');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const paymentID = params.get('paymentID') || '';
    const orderNumber = params.get('order') || '';
    const bkashStatus = params.get('status') || '';

    const fail = (msg: string) => {
      setState('fail');
      setMessage(msg);
    };

    if (!paymentID || !orderNumber) {
      fail('কলব্যাক তথ্য অসম্পূর্ণ');
      return;
    }
    if (bkashStatus === 'cancel') {
      fail('আপনি পেমেন্ট বাতিল করেছেন — অর্ডারটি পেন্ডিং থাকবে');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/pay/bkash/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentID, orderNumber }),
        });
        const data = (await res.json()) as { ok?: boolean; completed?: boolean; trxID?: string | null; statusMessage?: string };
        if (data.completed) {
          // লোকাল db-তে অর্ডার PAID করো (cloud sync RTDB-তে নিয়ে যাবে)
          const order = db.collection('orders').find((o) => o.orderNumber === orderNumber);
          if (order) {
            const now = new Date().toISOString();
            db.put('orders', {
              ...order,
              paymentStatus: 'PAID',
              status: 'CONFIRMED',
              transaction: { ...(order.transaction ?? {}), trxId: data.trxID ?? null, verifiedAt: now, verifiedBy: 'bkash-api' },
              statusHistory: [...order.statusHistory, { status: 'CONFIRMED', at: now, note: `bKash পেমেন্ট সম্পন্ন (TrxID: ${data.trxID ?? '-'})`, by: 'bkash-api' }],
              updatedAt: now,
            });
            markCartRecovered();
          }
          setState('ok');
          setMessage(`পেমেন্ট সফল! TrxID: ${data.trxID ?? '-'}`);
          setTimeout(() => router.replace(`/order-success?order=${encodeURIComponent(orderNumber)}`), 1600);
        } else {
          fail(data.statusMessage || 'পেমেন্ট সম্পন্ন হয়নি — অর্ডারটি পেন্ডিং আছে');
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
        <h1 className="mt-4 text-lg font-bold">bKash পেমেন্ট</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {state === 'fail' && (
          <Button className="mt-5 w-full" onClick={() => router.replace('/')}>হোমপেজে ফিরুন</Button>
        )}
      </div>
    </div>
  );
}

export default function BkashReturnPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <BkashReturnInner />
    </Suspense>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-6xl font-extrabold text-primary">৪০৪</p>
      <h1 className="text-xl font-bold">পেজটি খুঁজে পাওয়া যায়নি</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        আপনি যে ঠিকানাটি খুঁজছেন সেটি হয়তো বদলে গেছে বা মুছে ফেলা হয়েছে। হোম পেজ থেকে আবার শুরু করুন।
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          হোম পেজে যান
        </Link>
        <Link
          href="/shop"
          className="rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-accent"
        >
          সকল পণ্য দেখুন
        </Link>
      </div>
    </main>
  );
}

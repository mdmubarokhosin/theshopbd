'use client';

import { useMemo, useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SectionHeader } from './home-view';
import { useStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { pageBySlug, createTicket } from '@/lib/db/services';
import type { CmsPage } from '@/lib/db/types';
import type { InfoPage } from '@/lib/types';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  about: { title: 'আমাদের সম্পর্কে', subtitle: 'THE SHOP BD — মাল্টিব্র্যান্ড অনলাইন শপিং অভিজ্ঞতা' },
  contact: { title: 'যোগাযোগ করুন', subtitle: 'আমাদের কাছ থেকে শুনতে চাই' },
  faq: { title: 'সাধারণ প্রশ্ন', subtitle: 'আপনার জিজ্ঞাসার উত্তর' },
  shipping: { title: 'শিপিং পলিসি', subtitle: 'ডেলিভারি প্রক্রিয়া ও চার্জ' },
  cancellation: { title: 'ক্যান্সেলেশন পলিসি', subtitle: 'অর্ডার বাতিল ও রিটার্ন নীতিমালা' },
  terms: { title: 'শর্তাবলী', subtitle: 'ব্যবহারের শর্তসমূহ' },
  privacy: { title: 'প্রাইভেসি পলিসি', subtitle: 'আপনার তথ্যের সুরক্ষা' },
  stories: { title: 'THE SHOP BD গল্প', subtitle: 'আমাদের যাত্রা ও অভিজ্ঞতা' },
};

/** CMS কনটেন্ট প্যারাগ্রাফে ভেঙে রেন্ডার */
function PageContent({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
      {paragraphs.map((para, i) => (
        <p key={i} className="whitespace-pre-line">{para}</p>
      ))}
    </div>
  );
}

export function InfoView({ page }: { page: InfoPage }) {
  // CMS পেজ (পাবলিশড) — না পাওয়া গেলে বিল্ট-ইন স্ট্যাটিক কনটেন্ট
  const cms = useMemo(() => pageBySlug(page), [page]);
  const meta = PAGE_META[page] ?? { title: cms?.title || 'তথ্য পেজ', subtitle: '' };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{meta.title}</h1>
        {meta.subtitle && <p className="mt-2 text-sm text-muted-foreground">{meta.subtitle}</p>}
      </div>
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {page === 'contact' ? (
          <ContactContent cms={cms} />
        ) : page === 'faq' ? (
          <FaqContent cms={cms} />
        ) : cms?.content ? (
          <PageContent content={cms.content} />
        ) : (
          <>
            {page === 'about' && <AboutContent />}
            {page === 'shipping' && <ShippingContent />}
            {page === 'cancellation' && <CancellationContent />}
            {page === 'terms' && <TermsContent />}
            {page === 'privacy' && <PrivacyContent />}
            {page === 'stories' && <StoriesContent />}
          </>
        )}
      </div>
    </div>
  );
}

function AboutContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
      <div className="rounded-xl bg-secondary/60 p-5 text-center">
        <p className="text-lg font-bold text-foreground">&ldquo;সব বিখ্যাত ব্র্যান্ডের অরিজিনাল পণ্য, এক ঠিকানায়&rdquo;</p>
      </div>
      <p>
        <strong className="text-foreground">THE SHOP BD</strong> একটি বাংলাদেশি মাল্টিব্র্যান্ড ই-কমার্স প্ল্যাটফর্ম, যা সারাদেশের মানুষের হাতের নাগালে
        অরিজিনাল ব্র্যান্ডেড পণ্য পৌঁছে দেওয়ার জন্য নিবেদিত। আমরা ২০২০ সাল থেকে আমাদের যাত্রা শুরু করি।
      </p>
      <p>
        বাজারে নকল ও কপি পণ্যের বিস্তার দিন দিন বাড়ছে। আমরা প্রতিশ্রুতি দিই — আমাদের প্ল্যাটফর্মের প্রতিটি পণ্য সরাসরি ব্র্যান্ড বা
        অথরাইজড ডিস্ট্রিবিউটরের কাছ থেকে সংগ্রহ করা। Samsung, Xiaomi, Aarong, Sailor, Bata, Apex-এর মতো বিখ্যাত ব্র্যান্ডের
        অরিজিনাল পণ্য এখন এক অ্যাপেই।
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { num: '৫০,০০০+', label: 'সন্তুষ্ট কাস্টমার' },
          { num: '২১+', label: 'বিখ্যাত ব্র্যান্ড' },
          { num: '৬৪', label: 'জেলায় ডেলিভারি' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border p-4 text-center">
            <div className="text-2xl font-extrabold text-primary">{s.num}</div>
            <div className="mt-1 text-xs">{s.label}</div>
          </div>
        ))}
      </div>
      <h3 className="pt-2 text-base font-bold text-foreground">আমাদের ক্যাটাগরি ও পণ্য</h3>
      <p>
        ইলেকট্রনিকস ও স্মার্ট গ্যাজেট, মোবাইল ও ট্যাবলেট, ছেলেদের ও মেয়েদের ফ্যাশন, জুতা, ঘড়ি ও অ্যাকসেসরিজ,
        ব্যাগ ও লাগেজ, ঘর ও লিভিং, বিউটি ও পার্সোনাল কেয়ার, স্পোর্টস ও ফিটনেস, বেবি ও টয়েজ, বই ও স্টেশনারি,
        গ্রোসারি — সব মিলিয়ে ৪০+ পণ্য, সব এক ঠিকানায়।
      </p>
    </div>
  );
}

function ContactContent({ cms }: { cms?: CmsPage }) {
  const settings = useStore((s) => s.siteSettings);
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);

  const send = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      toast({ title: 'সব ঘর পূরণ করুন', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const ticket = createTicket({
        name: form.name.trim(),
        phone: form.phone.trim(),
        subject: 'যোগাযোগ ফর্ম',
        message: form.message.trim(),
      });
      toast({
        title: 'বার্তা পাঠানো হয়েছে',
        description: `টিকেট নম্বর: ${ticket.ticketNumber} — আমরা শীঘ্রই যোগাযোগ করব`,
      });
      setForm({ name: '', phone: '', message: '' });
    } catch {
      toast({ title: 'সমস্যা হয়েছে', description: 'আবার চেষ্টা করুন', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      {cms?.content && <PageContent content={cms.content} />}
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          {[
            { icon: MapPin, title: 'ঠিকানা', lines: [settings.contact_address, 'বাংলাদেশ'].filter(Boolean) },
            { icon: Phone, title: 'হটলাইন', lines: [settings.contact_phone, settings.support_hours].filter(Boolean) },
            { icon: Mail, title: 'ইমেইল', lines: [settings.contact_email].filter(Boolean) },
            { icon: Clock, title: 'সময়সূচি', lines: [settings.support_hours, 'শুক্রবার: বিকাল ৩টা - রাত ১০টা'] },
          ].map((c) => (
            <div key={c.title} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{c.title}</div>
                {c.lines.map((l) => (
                  <div key={l} className="text-sm text-muted-foreground">{l}</div>
                ))}
              </div>
            </div>
          ))}
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => settings.social_whatsapp && window.open(settings.social_whatsapp, '_blank', 'noopener')}
          >
            <MessageCircle className="mr-2 h-4 w-4" /> হোয়াটসঅ্যাপে মেসেজ করুন
          </Button>
        </div>
        <div>
          <h3 className="mb-4 text-base font-bold text-foreground">বার্তা পাঠান</h3>
          <div className="space-y-3">
            <div>
              <Label>আপনার নাম</Label>
              <Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="নাম" />
            </div>
            <div>
              <Label>মোবাইল নম্বর</Label>
              <Input className="mt-1.5" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" />
            </div>
            <div>
              <Label>বার্তা</Label>
              <Textarea className="mt-1.5" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="আপনার বার্তা লিখুন..." />
            </div>
            <Button className="w-full" onClick={send} disabled={sending}>
              <Send className="mr-2 h-4 w-4" /> {sending ? 'পাঠানো হচ্ছে...' : 'পাঠিয়ে দিন'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** CMS FAQ কনটেন্ট পার্স: "প্রশ্ন: ...\nউত্তর: ..." ব্লক */
function parseFaq(content?: string): { q: string; a: string }[] {
  if (!content) return [];
  return content
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim());
      const q = (lines[0] || '').replace(/^\s*প্রশ্ন:\s*/, '').trim();
      const a = lines
        .slice(1)
        .join('\n')
        .replace(/^\s*উত্তর:\s*/, '')
        .trim();
      return { q, a };
    })
    .filter((f) => f.q && f.a);
}

function FaqContent({ cms }: { cms?: CmsPage }) {
  const cmsFaqs = useMemo(() => parseFaq(cms?.content), [cms]);
  const faqs = cmsFaqs.length
    ? cmsFaqs
    : [
      { q: 'আপনাদের পণ্য কি অরিজিনাল?', a: 'হ্যাঁ, আমরা ১০০% অরিজিনাল পণ্যের নিশ্চয়তা দিই। প্রতিটি পণ্য সরাসরি ব্র্যান্ড বা অথরাইজড ডিস্ট্রিবিউটর থেকে সংগ্রহ করা হয়। নকল পণ্য পাওয়া গেলে সম্পূর্ণ টাকা ফেরত নিশ্চিত।' },
      { q: 'পণ্যের রং বা সাইজ কিভাবে বাছবো?', a: 'প্রতিটি ভ্যারিয়েন্ট-যুক্ত পণ্যের ডিটেইলস পেজে রং ও সাইজ অপশন থাকবে। রং ও সাইজ বেছে নিয়ে তারপর কার্টে যোগ করুন। স্টক শেষ থাকা অপশনগুলো নিষ্ক্রিয় দেখাবে।' },
      { q: 'ডেলিভারি চার্জ কত?', a: 'ঢাকা সিটির ভিতরে ৳৬০ এবং ঢাকার বাইরে ৳১২০। ৳২০০০ বা তার বেশি অর্ডারে ঢাকায় ডেলিভারি ফ্রি।' },
      { q: 'ডেলিভারিতে কত সময় লাগে?', a: 'ঢাকার ভিতরে ২৪ ঘন্টা (কখনো কখনো দিনশেষ পর্যন্ত), ঢাকার বাইরে ৪৮-৭২ ঘন্টা। প্রি-অর্ডার পণ্যের ক্ষেত্রে সময় ভিন্ন হতে পারে।' },
      { q: 'কোন কোন পেমেন্ট মেথড আছে?', a: 'আমরা ক্যাশ অন ডেলিভারি (COD), বিকাশ, নগদ, রকেট এবং ভিসা/মাস্টারকার্ড (SSLCommerz) গ্রহণ করি।' },
      { q: 'অর্ডার কিভাবে বাতিল করব?', a: 'ক্যাশ অন ডেলিভারি অর্ডার পাঠানোর আগে যেকোনো সময় বিনা চার্জে বাতিল করা যায় — হটলাইনে কল করুন। অনলাইন পেমেন্টের ক্ষেত্রে নিয়মাবলি ক্যান্সেলেশন পলিসি পেজে দেখুন।' },
      { q: 'পণ্য রিটার্ন করা যায়?', a: 'পণ্য হাতে পাওয়ার ২৪ ঘন্টার মধ্যে, অব্যবহৃত অবস্থায় ও মূল প্যাকেজিংসহ রিটার্ন করা যাবে। ড্যামেজ বা নকল পণ্যের ক্ষেত্রে সম্পূর্ণ টাকা ফেরত বা রিপ্লেসমেন্ট দেওয়া হবে।' },
      { q: 'সারাদেশে ডেলিভারি করেন?', a: 'হ্যাঁ, বাংলাদেশের ৬৪ জেলায় আমরা ডেলিভারি করি। কুরিয়ার পার্টনারদের মাধ্যমে পণ্য পাঠানো হয়।' },
      { q: 'কুপন কোড কিভাবে ব্যবহার করব?', a: 'কার্ট বা চেকআউট পেজে কুপন কোড অপশনে কোডটি লিখে প্রয়োগ করুন। SHOP10, WELCOME50, SAVE100, NEW20 — চেষ্টা করতে পারেন।' },
    ];

  return (
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((f, i) => (
        <AccordionItem key={i} value={`item-${i}`}>
          <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">{f.q}</AccordionTrigger>
          <AccordionContent className="whitespace-pre-line text-sm text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function ShippingContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
      <p>THE SHOP BD বাংলাদেশের সর্বত্র নিরাপদ ও সময়মতো ডেলিভারি নিশ্চিত করে। নিচে আমাদের ডেলিভারি প্রক্রিয়া ও চার্জ দেওয়া হলো:</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="p-3 text-left font-semibold text-foreground">এলাকা</th>
              <th className="p-3 text-left font-semibold text-foreground">চার্জ</th>
              <th className="p-3 text-left font-semibold text-foreground">সময়</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr><td className="p-3">ঢাকা সিটি</td><td className="p-3">৳৬০</td><td className="p-3">২৪ ঘন্টা</td></tr>
            <tr><td className="p-3">ঢাকা সবজোন (৳২০০০+)</td><td className="p-3 text-green-600 font-medium">ফ্রি</td><td className="p-3">২৪ ঘন্টা</td></tr>
            <tr><td className="p-3">ঢাকার বাইরে</td><td className="p-3">৳১২০</td><td className="p-3">৪৮-৭২ ঘন্টা</td></tr>
          </tbody>
        </table>
      </div>
      <h3 className="text-base font-bold text-foreground">ডেলিভারি প্রক্রিয়া</h3>
      <ol className="list-decimal space-y-2 pl-5">
        <li>অর্ডার নিশ্চিত করার জন্য আমাদের প্রতিনিধি ফোনে যোগাযোগ করবেন।</li>
        <li>স্টকে পণ্য থাকলে ঐ দিনেই প্যাক করে কুরিয়ারে পাঠানো হয়।</li>
        <li>কুরিয়ার পার্টনার আপনার ঠিকানায় পণ্য পৌঁছে দেবে।</li>
        <li>পণ্য হাতে পেয়ে চেক করে পেমেন্ট করার সুযোগ (COD)।</li>
      </ol>
      <p className="rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <strong>নোট:</strong> প্রাকৃতিক দুর্যোগ বা রাজনৈতিক অস্থিরতার ক্ষেত্রে ডেলিভারি সময় বাড়তে পারে।
      </p>
    </div>
  );
}

function CancellationContent() {
  const settings = useStore((s) => s.siteSettings);
  const hotline = settings.contact_phone || '';
  return (
    <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
      <h3 className="text-base font-bold text-foreground">অর্ডার বাতিল</h3>
      <p><strong className="text-foreground">COD অর্ডার:</strong> পাঠানোর আগে যেকোনো সময় বিনা চার্জে বাতিল করা যায়।{hotline ? <> হটলাইনে ({hotline}) কল করুন।</> : ' হটলাইনে কল করুন।'}</p>
      <p><strong className="text-foreground">অনলাইন পেমেন্ট (বিকাশ/নগদ/কার্ড):</strong> প্রসেসিং শুরুর আগে বাতিল করলে ৩-৫ কর্মদিবসের মধ্যে টাকা ফেরত দেওয়া হবে।</p>
      <h3 className="pt-3 text-base font-bold text-foreground">রিটার্ন ও রিফান্ড</h3>
      <ul className="list-disc space-y-2 pl-5">
        <li>পণ্য হাতে পাওয়ার ২৪ ঘন্টার মধ্যে সমস্যা জানাতে হবে।</li>
        <li>ড্যামেজ বা নকল পণ্যের ছবি সহ প্রমাণ দিতে হবে।</li>
        <li>অব্যবহৃত, মূল প্যাকেজিংসহ পণ্য ফেরত দিতে হবে।</li>
        <li>কসমেটিক ও পার্সোনাল কেয়ার পণ্য খোলা/ব্যবহৃত হলে রিটার্ন প্রযোজ্য নয়।</li>
        <li>রিফান্ড ৩-৭ কর্মদিবসের মধ্যে বিকাশ/নগদ/ব্যাংকে দেওয়া হবে।</li>
      </ul>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
      <p>THE SHOP BD (theshopbd.com) ওয়েবসাইট ব্যবহারের মাধ্যমে আপনি নিম্নলিখিত শর্তে সম্মত হচ্ছেন:</p>
      <div>
        <h3 className="mb-2 text-base font-bold text-foreground">১. অর্ডার ও মূল্য</h3>
        <p>সকল মূল্য বাংলাদেশি টাকায় (BDT) প্রকাশিত। পণ্যের দাম যেকোনো সময় পরিবর্তন হতে পারে। অর্ডার নিশ্চিত হওয়ার পর ফোনে কনফার্মেশন প্রয়োজন।</p>
      </div>
      <div>
        <h3 className="mb-2 text-base font-bold text-foreground">২. পণ্যের বর্ণনা</h3>
        <p>পণ্যের ছবি ও বর্ণনা যথাসম্ভব সঠিক রাখার চেষ্টা করা হয়। ভ্যারিয়েন্ট-যুক্ত পণ্যে রং/সাইজ নির্বাচন করার দায়িত্ব ক্রেতার। ডিসপ্লের কারণে রং-এ সামান্য পার্থক্য থাকতে পারে।</p>
      </div>
      <div>
        <h3 className="mb-2 text-base font-bold text-foreground">৩. দায়বদ্ধতা</h3>
        <p>যেকোনো প্রশ্নে হটলাইনে যোগাযোগ করুন। আমাদের সর্বোচ্চ দায় অর্ডারের মূল্য সীমিত।</p>
      </div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
      <p>আপনার ব্যক্তিগত তথ্যের সুরক্ষা আমাদের কাছে গুরুত্বপূর্ণ:</p>
      <div>
        <h3 className="mb-2 text-base font-bold text-foreground">যে তথ্য সংগ্রহ করি</h3>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>নাম, ফোন নম্বর, ডেলিভারি ঠিকানা (অর্ডার সম্পাদনের জন্য)</li>
          <li>ইমেইল (নিউজলেটারের জন্য, অপ্ট-আউট সম্ভব)</li>
          <li>ব্রাউজিং তথ্য (ওয়েবসাইট উন্নতির জন্য)</li>
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-base font-bold text-foreground">তথ্য ব্যবহার</h3>
        <p>আপনার তথ্য শুধুমাত্র অর্ডার প্রসেসিং, ডেলিভারি ও কাস্টমার সাপোর্টে ব্যবহৃত হয়। তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।</p>
      </div>
      <div>
        <h3 className="mb-2 text-base font-bold text-foreground">পেমেন্ট নিরাপত্তা</h3>
        <p>পেমেন্ট তথ্য এনক্রিপ্টেড ও সুরক্ষিত। আমরা আপনার কার্ড নম্বর বা পিন সংরক্ষণ করি না।</p>
      </div>
    </div>
  );
}

function StoriesContent() {
  const stories = [
    {
      title: 'শুরুর গল্প — একটি ছোট অ্যাপার্টমেন্ট থেকে',
      text: '২০২০ সালে ঢাকার একটি ছোট অ্যাপার্টমেন্ট থেকে আমাদের যাত্রা শুরু। লকডাউনে ঘরে বসে থাকা মানুষদের জন্য অরিজিনাল পণ্য পৌঁছে দেওয়াই ছিল লক্ষ্য। আজ ৫০,০০০+ কাস্টমার আমাদের আস্থা করেছেন।',
    },
    {
      title: 'ব্র্যান্ডের সাথে সরাসরি অংশীদারত্ব',
      text: 'আমরা Samsung, Xiaomi, Aarong, Sailor, Bata-র মতো ব্র্যান্ডের অথরাইজড রিসেলার ও ডিস্ট্রিবিউটরদের সাথে সরাসরি কাজ করি। কোনো মিডলম্যান নেই — তাই নকল পণ্যের ঝুঁকিও নেই, দামও থাকে সাশ্রয়ী।',
    },
    {
      title: '৬৪ জেলায় পৌঁছে যাওয়ার গর্ব',
      text: 'দেশের ৬৪ জেলার মানুষ এখন ঘরে বসে অর্ডার করে হাতে পেয়ে চেক করে টাকা দেন। কুরিয়ার পার্টনারদের সাথে মিলে আমরা প্রতিদিন হাজারো পার্সেল পৌঁছে দিই।',
    },
  ];

  return (
    <div className="space-y-6">
      {stories.map((s) => (
        <div key={s.title} className="rounded-xl border bg-secondary/30 p-5">
          <h3 className="font-bold text-foreground">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
        </div>
      ))}
      <div className="rounded-xl bg-primary/5 p-5 text-center">
        <p className="font-semibold text-foreground">আপনার সাথে আমাদের যাত্রা চলমান 🇧🇩</p>
        <p className="mt-1 text-sm text-muted-foreground">অরিজিনাল পণ্যের এই আন্দোলনে যুক্ত হোন</p>
      </div>
    </div>
  );
}

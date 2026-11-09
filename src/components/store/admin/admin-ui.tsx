'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Upload, X, Loader2, Images, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fileToDataUrl } from '@/lib/db/image-tools';
import { addMedia, deleteMedia } from '@/lib/db/services';
import { isGithubConfigured, uploadDataUrlToGithub } from '@/lib/db/github';
import { useCollection } from '@/lib/db/hooks';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/** হাইড্রেশন-সেফ mount গেট: সার্ভার স্ন্যাপশট false, ক্লায়েন্ট true */
const emptySubscribe = () => () => {};
export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * Reusable image upload field for the admin panel.
 * ছবি ক্লায়েন্ট-সাইডে রিসাইজ হয়ে GitHub রিপোতে আপলোড হয় এবং jsDelivr CDN URL
 * onChange-এ পাঠানো হয় (GitHub কনফিগার না থাকলে dataURL ফলব্যাক)।
 * "লাইব্রেরি" বাটন থেকে আগে আপলোড করা ছবিও বেছে নেওয়া বা ডিলিট করা যায়।
 */
export function ImageUploadField({
  value,
  onChange,
  folder,
  label,
  hint,
  aspect = 'square',
}: {
  value: string;
  onChange: (url: string) => void;
  folder: 'brands' | 'categories' | 'payments' | 'site' | 'popup' | 'products';
  label?: string;
  hint?: string;
  aspect?: 'square' | 'wide' | 'logo';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mediaRaw = useCollection('media');
  const media = useMemo(
    () => (Array.isArray(mediaRaw) ? mediaRaw : []).filter((m) => !!m && typeof m === 'object' && typeof m.id === 'string'),
    [mediaRaw],
  );
  const { toast } = useToast();

  const maxWidth = folder === 'brands' || folder === 'payments' ? 400 : 900;

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file, maxWidth);
      const name = file.name.replace(/\.[^.]+$/, '') || 'ছবি';

      // প্রাথমিক পথ: GitHub রিপো হোস্টিং → jsDelivr CDN URL
      if (isGithubConfigured()) {
        const res = await uploadDataUrlToGithub(dataUrl, file.name, folder);
        if (res.ok && res.url) {
          try {
            addMedia(name, res.url);
          } catch {
            // লাইব্রেরি সেভ ব্যর্থ হলেও ফিল্ডে URL ব্যবহার হবে
          }
          onChange(res.url);
          return;
        }
        setError(res.error || 'GitHub আপলোড ব্যর্থ — dataURL হিসেবে সংরক্ষণ করা হলো');
      } else {
        setError('GitHub হোস্টিং কনফিগার করা হয়নি — ছবিটি সাময়িক dataURL হিসেবে সেভ হলো');
      }

      // ফলব্যাক: GitHub নেই/ব্যর্থ — dataURL (সাইট ভাঙবে না)
      try {
        addMedia(name, dataUrl);
      } catch {
        // কোটা সমস্যা হলেও ছবিটি ফিল্ডে ব্যবহার করা যাবে
      }
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ছবি আপলোড করা যায়নি');
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (id: string, dataUrl: string, name: string) => {
    setDeletingId(id);
    try {
      deleteMedia(id);
      // মুছে ফেলা ছবিটি যদি বর্তমান ফিল্ডে সিলেক্ট করা থাকে, ফিল্ড খালি করে দিন
      if (value === dataUrl) onChange('');
      toast({ title: 'ছবিটি লাইব্রেরি থেকে মুছে ফেলা হয়েছে', description: name });
    } catch {
      toast({ title: 'মুছতে ব্যর্থ হয়েছে', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const heightCls = aspect === 'wide' ? 'h-32' : aspect === 'logo' ? 'h-16' : 'h-24';
  const previewCls = aspect === 'wide' ? 'object-cover' : 'object-contain';

  return (
    <div>
      {label && <div className="mb-1.5 text-sm font-medium">{label}</div>}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'relative w-32 shrink-0 overflow-hidden rounded-lg border border-dashed bg-muted/40',
            heightCls
          )}
        >
          {value ? (
            <>
              {/* data URL প্রিভিউ — next/image data: URI সাপোর্ট করে না, তাই plain img */}
              <img src={value} alt="প্রিভিউ" className={cn('h-full w-full', previewCls)} />
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow"
                aria-label="ছবি সরান"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground/40">
              <Upload className="h-5 w-5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'প্রসেস হচ্ছে...' : 'ছবি আপলোড করুন'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLibOpen(true)}
              className="gap-1.5"
            >
              <Images className="h-3.5 w-3.5" /> লাইব্রেরি
            </Button>
          </div>
          {error && <p className="mt-1.5 text-[11px] font-medium text-destructive">{error}</p>}
          {hint && !error && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
        </div>
      </div>

      {/* মিডিয়া লাইব্রেরি ডায়ালগ */}
      <Dialog open={libOpen} onOpenChange={setLibOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>মিডিয়া লাইব্রেরি</DialogTitle>
            <DialogDescription>
              আগে আপলোড করা ছবি থেকে বেছে নিন বা ডিলিট করুন ({media.length} টি)
            </DialogDescription>
          </DialogHeader>
          {media.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              লাইব্রেরি খালি — আগে কোনো ছবি আপলোড করা হয়নি
            </p>
          ) : (
            <ScrollArea className="max-h-[55vh]">
              <div className="grid grid-cols-4 gap-2 pr-2 sm:grid-cols-5">
                {media.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'group relative aspect-square overflow-hidden rounded-lg border bg-muted transition-all hover:ring-2 hover:ring-primary',
                      value === m.dataUrl && 'border-primary ring-2 ring-primary'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onChange(m.dataUrl);
                        setLibOpen(false);
                      }}
                      className="block h-full w-full"
                      title={m.name}
                      aria-label={`${m.name} নির্বাচন করুন`}
                    >
                      <img src={m.dataUrl} alt={m.name} className="h-full w-full object-cover" />
                    </button>
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      {m.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMedia(m.id, m.dataUrl, m.name);
                      }}
                      disabled={deletingId === m.id}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white opacity-100 shadow transition-opacity focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label={`${m.name} লাইব্রেরি থেকে মুছুন`}
                      title="লাইব্রেরি থেকে মুছুন"
                    >
                      {deletingId === m.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          {media.length > 0 && (
            <p className="text-[11px] leading-snug text-muted-foreground">
              টিপ: ছবির উপরে ডাস্টবিন বাটনে চাপলে লাইব্রেরি থেকে স্থায়ীভাবে মুছে যাবে
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

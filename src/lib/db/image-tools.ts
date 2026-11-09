'use client';

/**
 * THE SHOP BD — ইমেজ টুলস
 * ---------------------------------------------------------------------------
 * সার্ভার আপলোড নেই: ফাইল ক্লায়েন্ট-সাইডে রিসাইজ করে dataURL হিসেবে
 * মিডিয়া লাইব্রেরিতে (localStorage) সংরক্ষণ করা হয়।
 * ভবিষ্যতে রিয়েল ব্যাকএন্ড থাকলে uploadMedia() একটি fetch POST হবে।
 */

/** ফাইল → রিসাইজ করা dataURL (JPEG, সর্বোচ্চ maxWidth) */
export function fileToDataUrl(file: File, maxWidth = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('শুধু ছবি ফাইল আপলোড করা যাবে'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('ক্যানভাস তৈরি ব্যর্থ'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('ছবি পড়া যায়নি'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('ফাইল পড়া যায়নি'));
    reader.readAsDataURL(file);
  });
}

/** dataURL → ডাউনলোডযোগ্য ফাইল (ব্যাকআপে ব্যবহার হয় না, ডিবাগে কাজে লাগে) */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

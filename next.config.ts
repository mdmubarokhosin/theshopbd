import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Termux/মোবাইলে চালানোর জন্য standalone output বাদ — সাধারণ next start যথেষ্ট
  images: {
    // sharp ছাড়াই চলে (Termux-বান্ধব); ছবিগুলো লোকাল/ডেটা-URL তাই অপটিমাইজ দরকার নেই
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // X-Powered-By হেডার বন্ধ — প্রোডাকশন সিকিউরিটি হার্ডেনিং
  poweredByHeader: false,
  // প্রিভিউ প্যানেল হোস্ট থেকে dev রিসোর্স (ফন্ট ইত্যাদি) ব্লক এড়াতে
  allowedDevOrigins: ["*.space-z.ai", "localhost"],
};

export default nextConfig;

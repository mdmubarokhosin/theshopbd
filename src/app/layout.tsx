import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { CloudProvider } from "@/components/store/cloud-provider";

/* ফন্ট: সিস্টেম ফন্ট স্ট্যাক (globals.css-এ --font-sans দেখুন)।
   next/font/google বাদ দেওয়া হয়েছে — কম্পাইল-টাইমে Google Fonts ডাউনলোড
   Termux/স্লো ইন্টারনেটে ব্যর্থ হতে পারে। Android/iOS-এ বাংলা সিস্টেম ফন্টে
   সুন্দরভাবে রেন্ডার হয়। */

export const metadata: Metadata = {
  title: "THE SHOP BD — মাল্টিব্র্যান্ড অনলাইন শপিং",
  description:
    "THE SHOP BD — বাংলাদেশের সেরা মাল্টিব্র্যান্ড অনলাইন শপ। ইলেকট্রনিকস, মোবাইল, ফ্যাশন ও পোশাক, ঘর ও লিভিং, বিউটি সহ ২১+ বিখ্যাত ব্র্যান্ডের অরিজিনাল পণ্য ঘরে বসেই অর্ডার করুন, দ্রুত হোম ডেলিভারি সারাদেশে।",
  keywords: [
    "THE SHOP BD",
    "The Shop BD",
    "মাল্টিব্র্যান্ড শপ",
    "অনলাইন শপিং বাংলাদেশ",
    "ইলেকট্রনিকস",
    "অনলাইন ফ্যাশন",
    "স্মার্টফোন",
    "ব্র্যান্ডেড পণ্য",
    "হোম ডেলিভারি",
  ],
  manifest: "/manifest.webmanifest",
  applicationName: "THE SHOP BD",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "THE SHOP BD",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  openGraph: {
    title: "THE SHOP BD — মাল্টিব্র্যান্ড অনলাইন শপিং",
    description:
      "ইলেকট্রনিকস, ফ্যাশন, হোম ও লিভিং, বিউটি — ২১+ বিখ্যাত ব্র্যান্ডের অরিজিনাল পণ্য এক ঠিকানায়। সারাদেশে দ্রুত হোম ডেলিভারি।",
    siteName: "THE SHOP BD",
    type: "website",
    locale: "bn_BD",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a5c38",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <CloudProvider />
        {children}
        <Toaster />
      </body>
    </html>
  );
}

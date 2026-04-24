import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import { Header } from "@/components/layout/Header";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rentmap — Bangalore 2BHK Rentals, with Truth Badges",
    template: "%s | Rentmap",
  },
  description:
    "Every Bangalore 2BHK listing on one map. Owner vs broker. Fair price vs overpriced. No brokerage, no bullshit.",
  openGraph: {
    type: "website",
    siteName: "Rentmap",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10b981",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Header />
        <main className="min-h-[calc(100dvh-3.5rem)]">{children}</main>
        <Toaster position="top-center" />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

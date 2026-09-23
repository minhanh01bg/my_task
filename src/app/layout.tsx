import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";

import { siteConfig } from "@/config/site";
import { ObservabilityProvider } from "@/components/providers/observability-provider";
import { Providers } from "@/providers";

import "./globals.css";

const sans = Be_Vietnam_Pro({
  variable: "--font-sans",
  // 800 vẫn được dùng (`font-extrabold`) ở order-success, countdown, POS.
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "vietnamese"],
});
const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Chỉ dùng cho mã/SKU ở vài chỗ — không preload để khỏi chặn LCP.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    siteName: siteConfig.name,
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/apple-icon.png",
  },
};

/** Khớp token `--background` trong globals.css (sáng: oklch(0.978 0.008 82), tối: oklch(0.145 0 0)). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`h-full antialiased ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
        <ObservabilityProvider />
      </body>
    </html>
  );
}

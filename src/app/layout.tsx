import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { siteConfig } from "@/config/site";
import { ObservabilityProvider } from "@/components/providers/observability-provider";
import { ServiceWorkerRegistrar } from "@/components/pos/service-worker-registrar";
import { Providers } from "@/providers";

import "./globals.css";

// Inter co subset "vietnamese" — bat buoc vi toan bo giao dien la tieng Viet.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});
const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
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
      <body className="min-h-full bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>{children}</Providers>
        <ObservabilityProvider />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist_Mono, Nunito_Sans, Rubik } from "next/font/google";

import { siteConfig } from "@/config/site";
import { ObservabilityProvider } from "@/components/providers/observability-provider";
import { ServiceWorkerRegistrar } from "@/components/pos/service-worker-registrar";
import { Providers } from "@/providers";

import "./globals.css";

const sans = Nunito_Sans({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});
const heading = Rubik({
  variable: "--font-heading-family",
  subsets: ["latin", "latin-ext"],
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
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="bg-background text-foreground min-h-full">
        <Providers>{children}</Providers>
        <ObservabilityProvider />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

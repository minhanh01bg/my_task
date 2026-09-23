import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/shop.webmanifest",
};

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

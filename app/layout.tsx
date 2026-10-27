import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cards with Kurt & Friends — MTG life & game tracker",
  description:
    "Game night, sorted. Commander, Planechase, Archenemy and Kingdoms — one code, and every life total at the table stays in sync.",
  applicationName: "Cards with Kurt & Friends",
};

export const viewport: Viewport = {
  themeColor: "#0b0a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

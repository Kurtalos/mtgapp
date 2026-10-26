import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mana Table — MTG life & game tracker",
  description:
    "A shared life counter for Commander, Planechase, Archenemy and Kingdoms. Create a table, share the code, everyone joins from their phone.",
  applicationName: "Mana Table",
};

export const viewport: Viewport = {
  themeColor: "#06070c",
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

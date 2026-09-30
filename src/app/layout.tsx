import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/layout/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Magaños Classic Plaza Hotel",
    template: "%s | Magaños",
  },
  description: "Gestion des clients et des séjours - Magaños Classic Plaza Hotel.",
  // Internal tool: keep it out of search engines.
  robots: { index: false, follow: false },
  applicationName: "Magaños",
  appleWebApp: { capable: true, title: "Magaños", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#162724",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

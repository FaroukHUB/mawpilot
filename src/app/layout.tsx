import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { ServiceWorkerRegistration } from "@/components/layout/service-worker";
import { BRAND_FULL } from "@/components/layout/wordmark";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: BRAND_FULL,
    template: `%s · ${BRAND_FULL}`,
  },
  description:
    "Application privée de pilotage d'activité freelance : entreprises, tâches, temps, rapports et assistant IA.",
  applicationName: BRAND_FULL,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: BRAND_FULL,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
  // Application privée : jamais indexée.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#111111" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  // Ne jamais empêcher le zoom : c'est une règle d'accessibilité.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#contenu-principal"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
        >
          Aller au contenu principal
        </a>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

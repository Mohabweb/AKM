import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const manrope = localFont({ src: "./fonts/manrope.woff2", variable: "--font-manrope", display: "swap", weight: "200 800" });
const fraunces = localFont({ src: "./fonts/fraunces.woff2", variable: "--font-fraunces", display: "swap", weight: "100 900" });
const gloock = localFont({ src: "./fonts/gloock.woff2", variable: "--font-gloock", display: "swap", weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Sneakers, heels, boots & more`, template: `%s | ${SITE_NAME}` },
  description: "Shoes for women and men from Alexandria, Egypt: sneakers, heels, boots, slides and more. Cash on delivery across Egypt.",
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_EG" },
};
export const viewport: Viewport = { themeColor: "#1395A4", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${manrope.variable} ${fraunces.variable} ${gloock.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sand">Skip to content</a>
        {children}
      </body>
    </html>
  );
}

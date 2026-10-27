import { Suspense, type ReactNode } from "react";
import { AnnouncementBar } from "@/components/ui/AnnouncementBar";
import { ToastProvider } from "@/components/ui/Toast";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";

/** Storefront chrome. Browsing pages only — the cart/checkout flow lives in app/(flow) with motion switched off. */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Suspense fallback={null}><AnnouncementBar /></Suspense>
      <Suspense fallback={<div className="h-[7.5rem] md:h-16" />}><Header /></Suspense>
      <main id="main" className="has-bottom-nav flex-1 bg-white">{children}</main>
      <Suspense fallback={null}><Footer /></Suspense>
      <Suspense fallback={null}><BottomNav /></Suspense>
    </ToastProvider>
  );
}

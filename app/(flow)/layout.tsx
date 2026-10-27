import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

/** Cart, checkout, payment, confirmation, tracking: NO animations, transitions, popups or timers.
 *  [data-flow] switches every animation/transition off in globals.css; nothing here mounts toasts, drawers or offer popups. */
export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <div data-flow className="flex min-h-dvh flex-col">
      <header className="border-b border-ink/10 bg-sand">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="AKM Luxury Shoes — home"><Logo className="h-9 w-auto" /></Link>
          <Link href="/shop" className="text-sm font-semibold underline underline-offset-4">Continue shopping</Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-ink/10 px-4 py-6 text-center text-xs text-muted">
        <Link href="/shipping" className="underline">Shipping</Link> · <Link href="/returns" className="underline">Returns</Link> · <Link href="/payment" className="underline">Payment</Link> · <Link href="/privacy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link>
      </footer>
    </div>
  );
}

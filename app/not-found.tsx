import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main id="main" className="sky grid min-h-dvh place-items-center p-4 text-center text-white">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-ink shadow-xl sm:p-12">
        <div className="mx-auto inline-block rounded-lg bg-sand p-2"><Logo className="h-9 w-auto" /></div>
        <p className="mono mt-8 text-[11px] text-muted">• Error 404</p>
        <h1 className="display-tight mt-3 text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-sans)" }}>This page took a wrong step.</h1>
        <p className="mt-4 text-muted">The page you are looking for does not exist or has moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="mono inline-flex min-h-11 items-center rounded-full bg-lime px-6 text-xs font-bold text-ink hover:bg-lime-2">Back to home</Link>
          <Link href="/shop" className="mono inline-flex min-h-11 items-center rounded-full bg-ink px-6 text-xs text-white hover:bg-ink-2">Browse shoes</Link>
        </div>
      </div>
    </main>
  );
}

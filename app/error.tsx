"use client";
import Link from "next/link";

/** Branded 500. Never shows the error message to visitors (it can contain internals). */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="sky grid min-h-dvh place-items-center p-4 text-center text-white">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-ink shadow-xl sm:p-12">
        <p className="mono text-[11px] text-muted">• Error 500</p>
        <h1 className="display-tight mt-3 text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-sans)" }}>Something went wrong on our side.</h1>
        <p className="mt-4 text-muted">Your cart and any placed order are safe. Please try again in a moment.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="mono inline-flex min-h-11 items-center rounded-full bg-lime px-6 text-xs font-bold text-ink hover:bg-lime-2">Try again</button>
          <Link href="/" className="mono inline-flex min-h-11 items-center rounded-full bg-ink px-6 text-xs text-white hover:bg-ink-2">Back to home</Link>
        </div>
      </div>
    </main>
  );
}

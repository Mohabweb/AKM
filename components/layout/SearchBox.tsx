"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { formatEGP } from "@/lib/money";
import { SearchIcon } from "@/components/icons";

type Sugg = { products: { slug: string; name: string; brand: string | null; price_piasters: number }[]; brands: { slug: string; name: string }[] };

export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [s, setS] = useState<Sugg | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const id = useId();
  const box = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setS(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        if (r.ok) { setS(await r.json()); setOpen(true); }
      } catch { /* aborted or offline */ }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const has = s && (s.products.length || s.brands.length);
  return (
    <form ref={box} role="search" className="relative w-full" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { setOpen(false); router.push(`/search?q=${encodeURIComponent(q.trim())}`); } }}>
      <label htmlFor={id} className="sr-only">Search shoes and brands</label>
      <div className="flex min-h-11 items-center gap-2 rounded-full border border-ink/25 bg-white px-4">
        <SearchIcon width={18} height={18} />
        <input id={id} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} autoFocus={autoFocus}
          type="search" autoComplete="off" placeholder="Search shoes or brands" maxLength={60}
          aria-expanded={!!(open && has)} aria-controls={`${id}-list`}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          className="min-h-10 w-full bg-transparent text-base outline-none focus-visible:outline-none" />
      </div>
      {open && has && (
        <ul id={`${id}-list`} className="absolute inset-x-0 top-full z-40 mt-2 max-h-96 overflow-auto rounded-2xl border border-ink/15 bg-white p-2 shadow-xl">
          {s.brands.map((b) => (
            <li key={b.slug}><Link href={`/brand/${b.slug}`} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-between rounded-xl px-3 hover:bg-sand"><span className="font-semibold">{b.name}</span><span className="text-xs text-muted">Brand</span></Link></li>
          ))}
          {s.products.map((p) => (
            <li key={p.slug}><Link href={`/product/${p.slug}`} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 hover:bg-sand">
              <span className="min-w-0 truncate"><span className="font-semibold">{p.name}</span>{p.brand && <span className="text-muted"> · {p.brand}</span>}</span>
              <span className="tabular shrink-0 text-sm">{formatEGP(p.price_piasters)}</span></Link></li>
          ))}
          <li><Link href={`/search?q=${encodeURIComponent(q.trim())}`} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-teal-700 hover:bg-sand">See all results for “{q.trim()}”</Link></li>
        </ul>
      )}
    </form>
  );
}

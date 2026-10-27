"use client";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Price } from "@/components/ui/Price";
import { SizeChip } from "@/components/ui/SizeChip";
import { useToast } from "@/components/ui/Toast";
import { WishlistButton } from "./WishlistButton";
import { ChatIcon, ShareIcon, ChevronIcon } from "@/components/icons";
import { addToCart } from "@/lib/client/cart";
import { pushRecent } from "@/lib/client/lists";
import { cn } from "@/lib/cn";
import { formatEGP } from "@/lib/money";
import type { Variant } from "@/lib/catalog";

type P = {
  id: string; slug: string; name: string; brand: string | null; description: string | null;
  price: number; original: number; onSale: boolean; isDemo: boolean;
  images: { url: string; alt: string | null; color: string | null }[];
  variants: Variant[]; whatsapp: string; siteUrl: string; sizeGuide: ReactNode; promoNotes: string[];
};

export function ProductView(p: P) {
  const toast = useToast();
  const colors = useMemo(() => [...new Set(p.variants.map((v) => v.color))].filter(Boolean), [p.variants]);
  const [color, setColor] = useState(colors[0] ?? "");
  const [size, setSize] = useState<string | null>(null);
  const [img, setImg] = useState(0);
  const [guide, setGuide] = useState(false);
  const [bar, setBar] = useState(false);
  const cta = useRef<HTMLDivElement>(null);
  const sizeBox = useRef<HTMLFieldSetElement>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => { pushRecent(p.id); }, [p.id]);
  useEffect(() => {
    const el = cta.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const forColor = p.variants.filter((v) => v.color === color);
  const chosen = forColor.find((v) => v.size === size) ?? null;
  const anyStock = p.variants.some((v) => v.in_stock);
  const pickColor = (c: string) => {
    setColor(c); setHint(false);
    const cur = p.variants.find((v) => v.color === c && v.size === size);
    if (!cur?.in_stock) setSize(null);
    const i = p.images.findIndex((im) => im.color === c);
    if (i >= 0) setImg(i);
  };
  const add = () => {
    if (!chosen) { setHint(true); sizeBox.current?.scrollIntoView({ block: "center" }); sizeBox.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus(); return; }
    addToCart(chosen.id, 1);
    toast(`Added to cart — size ${chosen.size}`);
  };
  const share = async () => {
    const url = `${p.siteUrl}/product/${p.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else { await navigator.clipboard.writeText(url); toast("Link copied"); }
    } catch { /* user cancelled */ }
  };
  const wa = /^\d{8,15}$/.test(p.whatsapp)
    ? `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Hello AKM, I'd like to order: ${p.name}${chosen ? `, size ${chosen.size}${color ? `, ${color}` : ""}` : ""} — ${p.siteUrl}/product/${p.slug}`)}` : "";

  const cur = p.images[img];
  const go = (d: number) => setImg((i) => (i + d + p.images.length) % p.images.length);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      {/* gallery */}
      <div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand-2">
          {cur ? <Image key={cur.url} src={cur.url} alt={cur.alt ?? p.name} fill priority sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" /> : <div className="grid h-full place-items-center text-muted">No image yet</div>}
          {p.images.length > 1 && (
            <>
              <button type="button" aria-label="Previous image" onClick={() => go(-1)} className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90"><ChevronIcon dir="left" /></button>
              <button type="button" aria-label="Next image" onClick={() => go(1)} className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90"><ChevronIcon /></button>
            </>
          )}
          <p className="sr-only" aria-live="polite">Image {img + 1} of {Math.max(p.images.length, 1)}</p>
        </div>
        {p.images.length > 1 && (
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {p.images.map((im, i) => (
              <li key={im.url} className="shrink-0">
                <button type="button" onClick={() => setImg(i)} aria-label={`Show image ${i + 1}`} aria-current={i === img}
                  className={cn("relative block size-20 overflow-hidden rounded-xl border-2 bg-sand-2", i === img ? "border-ink" : "border-transparent")}>
                  <Image src={im.url} alt="" fill sizes="80px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* purchase panel */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        {p.brand && <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">{p.brand}</p>}
        <h1 className="mt-1 text-3xl sm:text-4xl">{p.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Price price={p.price} original={p.onSale ? p.original : null} size="lg" />
          {p.onSale && <Badge tone="teal">Sale</Badge>}
          {p.isDemo && <Badge tone="warn">Demo product</Badge>}
        </div>
        {p.promoNotes.map((n) => <p key={n} className="mt-2 text-sm font-semibold text-teal-700">{n}</p>)}

        {colors.length > 0 && (
          <fieldset className="mt-6"><legend className="mb-2 text-sm font-semibold">Colour: <span className="font-normal">{color}</span></legend>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={c === color} onClick={() => pickColor(c)}
                  className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold", c === color ? "border-ink bg-ink text-sand" : "border-ink/30 bg-white")}>{c}</button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset ref={sizeBox} className="mt-6">
          <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
            <span>Size{size && <span className="font-normal"> · {size}</span>}</span>
            <button type="button" onClick={() => setGuide(true)} className="font-semibold text-teal-700 underline underline-offset-4">Size guide</button>
          </legend>
          <div role="radiogroup" aria-label="Size" className="flex flex-wrap gap-2">
            {forColor.map((v) => (
              <SizeChip key={v.id} label={v.size} selected={size === v.size} soldOut={!v.in_stock}
                note={v.stock_left ? `only ${v.stock_left} left` : undefined} onClick={() => { setSize(v.size); setHint(false); }} />
            ))}
          </div>
          {hint && <p role="alert" className="mt-2 text-sm font-semibold text-danger">Please choose a size.</p>}
          {chosen?.stock_left ? <p className="mt-2 text-sm font-semibold text-warn">Only {chosen.stock_left} left in size {chosen.size}</p> : null}
        </fieldset>

        <div ref={cta} className="mt-6 grid gap-3">
          {anyStock ? <Button size="lg" full onClick={add}>Add to cart</Button> : <Button size="lg" full disabled>Sold out</Button>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-ink/30 px-8 text-base font-semibold hover:bg-white"><ChatIcon width={20} height={20} />Order via WhatsApp</a>}
          <div className="flex items-center gap-2">
            <WishlistButton productId={p.id} name={p.name} className="border border-ink/20" />
            <button type="button" onClick={share} aria-label="Share this product" className="grid size-11 place-items-center rounded-full border border-ink/20 bg-white/90 hover:bg-white"><ShareIcon /></button>
          </div>
        </div>
        {p.description && <div className="mt-8 whitespace-pre-line text-sm leading-relaxed text-ink-2">{p.description}</div>}
      </div>

      {/* sticky mobile bar */}
      {bar && anyStock && (
        <div className="fixed inset-x-0 bottom-14 z-30 border-t border-ink/15 bg-sand px-4 py-2 lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="tabular text-sm">{formatEGP(p.price)}{size ? ` · size ${size}` : ""}</p></div>
            <Button onClick={add}>{chosen ? "Add to cart" : "Choose size"}</Button>
          </div>
        </div>
      )}
      <Drawer open={guide} onClose={() => setGuide(false)} title="Size guide" side="bottom"><div className="p-5">{p.sizeGuide}</div></Drawer>
    </div>
  );
}

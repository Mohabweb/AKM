import Image from "next/image";
import Link from "next/link";
import type { HomeSection, ProductCardData, Settings } from "@/lib/catalog";
import { formatEGP } from "@/lib/money";
import { ProductGrid } from "./ProductCard";
import { CashIcon, ChatIcon, TruckIcon } from "@/components/icons";

const s = (c: Record<string, unknown>, k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
/** Only internal paths are allowed as admin-configured links (blocks javascript: and off-site redirects). */
const safeHref = (h: string) => (/^\/(?!\/)[^\s]*$/.test(h) ? h : "");

type Tile = { key: string; node: React.ReactNode };

function ArrowDot() {
  return <span aria-hidden className="grid size-7 place-items-center rounded-full bg-ink text-lime"><svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12 12 4M5.5 4H12v6.5" /></svg></span>;
}

function Hero({ x, products, methods }: { x: HomeSection; products: ProductCardData[]; methods: string[] }) {
  const img = s(x.config, "image_url");
  const cta = safeHref(s(x.config, "cta_href"));
  const sec = safeHref(s(x.config, "secondary_href"));
  const glass = "rounded-2xl border border-white/40 bg-white/20 p-4 text-white shadow-lg backdrop-blur-md";
  const productTile = (p: ProductCardData): Tile => ({
    key: p.id,
    node: (
      <Link href={`/product/${p.slug}`} className="block overflow-hidden rounded-2xl bg-white p-2 text-ink shadow-xl" aria-label={p.name}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-sand-2">
          {p.image_url && <Image src={p.image_url} alt="" fill sizes="160px" className="object-cover" />}
        </div>
        <p className="mt-2 line-clamp-1 px-1 text-xs font-semibold">{p.name}</p>
        <p className="mono px-1 pb-1 text-[11px] text-muted">{formatEGP(p.price_piasters)}</p>
      </Link>
    ),
  });
  const info: Tile[] = [
    { key: "i1", node: <div className="flex aspect-[4/5] flex-col justify-between rounded-2xl bg-lime p-4 text-ink shadow-xl"><span className="mono text-[11px]">Delivery</span><p className="text-xl font-medium leading-tight tracking-tight">Across Egypt</p></div> },
    { key: "i2", node: <div className="flex aspect-[4/5] flex-col justify-between rounded-2xl bg-ink p-4 text-white shadow-xl"><span className="mono text-[11px] text-lime">Orders</span><p className="text-xl font-medium leading-tight tracking-tight">Track online</p></div> },
    { key: "i3", node: <div className={`${glass} flex aspect-[4/5] flex-col justify-between`}><span className="mono text-[11px]">Pay with</span><p className="text-base font-medium leading-snug">{methods.length ? methods.join(" · ") : "Secure checkout"}</p></div> },
  ];
  const ps = products.slice(0, 4).map(productTile);
  // interleave info tiles between products; fewer products simply means fewer tiles
  const tiles: Tile[] = [];
  const order = [info[2], ps[0], ps[1], info[0], ps[2], ps[3], info[1]].filter((t): t is Tile => !!t);
  tiles.push(...order);
  const mid = (tiles.length - 1) / 2;
  return (
    <section className="p-2 sm:p-3">
      <div className="sky relative isolate overflow-hidden rounded-3xl text-white">
        {img && <Image src={img} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-40 mix-blend-soft-light" />}
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:pt-20 lg:pt-24">
          <p className="mono reveal text-[11px] text-white/85">AKM Luxury Shoes · Alexandria</p>
          <h1 className="display-tight reveal mt-4 text-[2.6rem] sm:text-6xl lg:text-7xl" style={{ animationDelay: "80ms" }}>
            {x.title}
          </h1>
          {x.subtitle && <p className="reveal mx-auto mt-5 max-w-md text-base text-white/90 sm:text-lg" style={{ animationDelay: "160ms" }}>{x.subtitle}</p>}
          <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "240ms" }}>
            {sec && <Link href={sec} className="mono inline-flex min-h-11 items-center rounded-full bg-ink/70 px-6 text-xs text-white backdrop-blur hover:bg-ink">{s(x.config, "secondary_label") || "Browse"}</Link>}
            {cta && <Link href={cta} className="mono inline-flex min-h-11 items-center gap-3 rounded-full bg-lime py-1 pl-6 pr-1.5 text-xs font-bold text-ink hover:bg-lime-2">{s(x.config, "cta_label") || "Shop now"}<ArrowDot /></Link>}
          </div>
        </div>
        {tiles.length > 0 && (
          <ul className="fan mx-auto flex max-w-6xl items-end justify-center gap-3 px-4 pb-12 sm:gap-4">
            {tiles.map((t, i) => {
              const d = i - mid;
              const style = { "--ry": `${d * -9}deg`, "--ty": `${Math.abs(d) * 8}px`, "--sc": 1 - Math.abs(d) * 0.04 } as React.CSSProperties;
              // on phones only the centre three show
              const show = Math.abs(d) <= 1 ? "" : "hidden sm:block";
              return <li key={t.key} style={style} className={`w-[30%] max-w-[11rem] shrink-0 ${show}`}><div className="animate-float" style={{ animationDelay: `${i * 300}ms` }}>{t.node}</div></li>;
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Marquee({ x }: { x: HomeSection }) {
  const items = Array.isArray(x.config.items) ? (x.config.items as unknown[]).filter((i): i is string => typeof i === "string").slice(0, 12) : [];
  if (!items.length) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <li key={i} className="flex items-center gap-2.5 whitespace-nowrap text-lg font-semibold tracking-tight text-ink/55">
          <span aria-hidden className="grid size-6 place-items-center rounded-full bg-ink/15 text-[10px] text-ink/60">✦</span>{t}
        </li>
      ))}
    </ul>
  );
  return <div className="overflow-hidden bg-white py-7" role="presentation"><div className="flex w-max animate-marquee">{row(false)}{row(true)}</div></div>;
}

function Heading({ x, href }: { x: HomeSection; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div><p className="mono mb-2 text-[11px] text-muted">• {x.subtitle || "Collection"}</p><h2 className="display-tight text-3xl sm:text-5xl" style={{ fontFamily: "var(--font-sans)" }}>{x.title}</h2></div>
      {href && <Link href={href} className="mono shrink-0 rounded-full bg-ink px-4 py-2.5 text-[11px] text-white hover:bg-ink-2">View all</Link>}
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <section className="reveal-scroll mx-auto max-w-7xl px-4 py-12 sm:py-16">{children}</section>;
}

export function HomeSections({ sections, settings }: { sections: HomeSection[]; settings: Settings }) {
  const pm = (settings.payment_methods_enabled ?? {}) as Record<string, boolean>;
  const methods = [pm.cod && "Cash on delivery", pm.instapay && "InstaPay", pm.card && "Visa / Mastercard"].filter(Boolean) as string[];
  const heroProducts = sections.find((z) => z.type === "product_row")?.products ?? [];
  return (
    <>
      {sections.map((x) => {
        switch (x.type) {
          case "hero": return <Hero key={x.id} x={x} products={heroProducts} methods={methods} />;
          case "marquee": return <Marquee key={x.id} x={x} />;
          case "product_row": return <Wrap key={x.id}><Heading x={x} href={safeHref(s(x.config, "href"))} /><ProductGrid products={x.products.slice(0, 8)} priorityCount={0} /></Wrap>;
          case "category_tiles": return (
            <Wrap key={x.id}><Heading x={x} />
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {x.categories!.map((c) => (
                  <li key={c.id}><Link href={`/category/${c.slug}`} className="hover-lift group relative flex aspect-[4/3] items-end overflow-hidden rounded-[var(--radius-card)] bg-teal-700 p-4 text-sand">
                    {c.image_url && <Image src={c.image_url} alt="" fill sizes="25vw" className="-z-0 object-cover opacity-70" />}
                    <span className="relative text-xl" style={{ fontFamily: "var(--font-serif)" }}>{c.name}</span></Link></li>
                ))}
              </ul></Wrap>);
          case "brand_row": return (
            <Wrap key={x.id}><Heading x={x} />
              <ul className="flex flex-wrap gap-2">{x.brands!.map((b) => <li key={b.id}><Link href={`/brand/${b.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-ink/25 px-5 font-semibold hover:bg-white">{b.name}</Link></li>)}</ul></Wrap>);
          case "promo_banner": return safeHref(s(x.config, "href")) ? (
            <Wrap key={x.id}><Link href={safeHref(s(x.config, "href"))} className="block rounded-[var(--radius-card)] bg-teal-700 px-6 py-10 text-center text-sand"><h2 className="text-3xl">{x.title}</h2>{x.subtitle && <p className="mt-2">{x.subtitle}</p>}</Link></Wrap>) : null;
          case "trust_bar": return (
            <Wrap key={x.id}>
              <p className="mono text-center text-[11px] text-muted">• About us</p>
              <h2 className="display-tight mx-auto mt-4 max-w-3xl text-center text-3xl sm:text-5xl" style={{ fontFamily: "var(--font-sans)" }}>
                Luxury shoes from Alexandria, <span className="text-ink/45">delivered to your door across Egypt.</span>
              </h2>
              <div className="mt-10 grid gap-3 md:grid-cols-3">
                <div className="sky relative flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl p-3 md:row-span-2">
                  {heroProducts[0]?.image_url && <Image src={heroProducts[0].image_url} alt="" fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover opacity-80" />}
                  <div className="relative rounded-2xl bg-white p-5 text-ink">
                    <p className="text-4xl font-medium tracking-tight">Egypt-wide</p>
                    <p className="mt-2 text-sm text-muted">Delivery to your governorate. Shipping is calculated at checkout.</p>
                  </div>
                </div>
                <div className="flex min-h-56 flex-col justify-between rounded-3xl bg-mist p-6">
                  <div><p className="mono text-[11px] text-muted">Ways to pay</p><p className="mt-3 text-3xl font-medium tracking-tight">{methods.length ? methods.join(", ") : "Secure checkout"}</p></div>
                  <p className="text-sm text-muted">Choose at checkout. No account needed.</p>
                </div>
                <div className="flex min-h-56 flex-col justify-between rounded-3xl bg-lime p-6 text-ink">
                  <p className="mono text-[11px]">Track</p>
                  <div><p className="text-3xl font-medium tracking-tight">Follow your order online</p>
                    <Link href="/track" className="mono mt-4 inline-flex min-h-11 items-center gap-3 rounded-full bg-ink py-1 pl-5 pr-1.5 text-[11px] text-white">Track order<span aria-hidden className="grid size-7 place-items-center rounded-full bg-lime text-ink">→</span></Link></div>
                </div>
                <div className="flex min-h-24 items-center justify-between rounded-3xl bg-ink p-6 text-white md:col-span-2">
                  <p className="mono text-[11px] text-lime">Visit the store</p>
                  <p className="text-right text-lg font-medium tracking-tight">Alexandria, Egypt</p>
                </div>
              </div>
            </Wrap>);
          case "payment_methods": return methods.length ? (
            <Wrap key={x.id}><Heading x={x} /><ul className="flex flex-wrap gap-2">{methods.map((m) => <li key={m} className="rounded-full bg-white px-5 py-2 text-sm font-semibold">{m}</li>)}</ul></Wrap>) : null;
          default: return null;
        }
      })}
    </>
  );
}

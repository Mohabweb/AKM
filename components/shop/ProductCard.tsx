import Image from "next/image";
import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { WishlistButton } from "./WishlistButton";

export function ProductCard({ p, priority = false }: { p: ProductCardData; priority?: boolean }) {
  const isNew = p.is_new_arrival; // set by the store owner; no clock reads during prerender
  const sizes = "(min-width:1280px) 22vw, (min-width:768px) 30vw, 48vw";
  return (
    <article className="group relative">
      <Link href={`/product/${p.slug}`} className="block" aria-label={`${p.brand_name ? p.brand_name + " " : ""}${p.name}`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand-2">
          {p.image_url && <Image src={p.image_url} alt="" fill sizes={sizes} priority={priority}
            className={`object-cover transition-opacity duration-300 ${p.image2_url ? "group-hover:opacity-0" : ""}`} />}
          {p.image2_url && <Image src={p.image2_url} alt="" fill sizes={sizes}
            className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {!p.in_stock ? <Badge tone="ink">Sold out</Badge> : (
              <>
                {p.is_on_sale && <Badge tone="teal">Sale</Badge>}
                {isNew && <Badge tone="sand">New</Badge>}
              </>
            )}
          </div>
          {p.is_demo && <span className="absolute bottom-2 left-2 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sand">Demo</span>}
        </div>
        <div className="mt-3 px-0.5">
          {p.brand_name && <p className="text-xs font-semibold uppercase tracking-widest text-muted">{p.brand_name}</p>}
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug sm:text-base" style={{ fontFamily: "var(--font-sans)" }}>{p.name}</h3>
          <Price price={p.price_piasters} original={p.is_on_sale ? p.original_price_piasters : null} size="sm" className="mt-1" />
        </div>
      </Link>
      <WishlistButton productId={p.id} name={p.name} className="absolute right-2 top-2" />
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 4 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4">
      {products.map((p, i) => <ProductCard key={p.id} p={p} priority={i < priorityCount} />)}
    </div>
  );
}

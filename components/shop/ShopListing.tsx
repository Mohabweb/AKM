import Link from "next/link";
import { getBrands, getSizes, PAGE_SIZE, shopProducts, SORTS, type ShopQuery } from "@/lib/catalog";
import { buildShopHref, hasFilters, parseShopParams, type RawParams } from "@/lib/shop-params";
import { ProductGrid } from "@/components/shop/ProductCard";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink, Button } from "@/components/ui/Button";

const SORT_LABEL: Record<(typeof SORTS)[number], string> = {
  recommended: "Recommended", newest: "Newest", best_selling: "Best selling", price_asc: "Price: low to high", price_desc: "Price: high to low",
};

/** Server component: all state lives in the URL, so filters, sorting and pages work without JavaScript and can be shared. */
export async function ShopListing({ basePath, params, fixed }: { basePath: string; params: RawParams; fixed?: Partial<ShopQuery> }) {
  const parsed = parseShopParams(params);
  const query: ShopQuery = { ...parsed, ...fixed, brands: fixed?.brands ?? parsed.brands };
  const [{ products, total }, brands, sizes] = await Promise.all([shopProducts(query), getBrands(), getSizes()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = parsed.page;
  const filtered = hasFilters({ ...parsed, brands: fixed?.brands ? [] : parsed.brands });
  const chk = "size-5 accent-[var(--color-teal-600)]";
  const lbl = "flex min-h-11 items-center gap-3 text-sm";

  return (
    <div>
      <form method="get" action={basePath} className="mb-6">
        {parsed.q && <input type="hidden" name="q" value={parsed.q} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">{total} {total === 1 ? "product" : "products"}</p>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm font-semibold">Sort</label>
            <select id="sort" name="sort" defaultValue={parsed.sort} className="min-h-11 rounded-xl border border-ink/25 bg-white px-3 text-sm">
              {SORTS.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
            </select>
            <Button type="submit" size="sm" variant="dark">Apply</Button>
          </div>
        </div>
        <details className="mt-4 rounded-[var(--radius-card)] border border-ink/15 bg-white/60 open:bg-white" open={filtered}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-semibold [&::-webkit-details-marker]:hidden">
            Filters{filtered && <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs text-white">Active</span>}
          </summary>
          <div className="grid gap-8 border-t border-ink/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {!fixed?.brands && brands.length > 0 && (
              <fieldset><legend className="mb-1 font-semibold">Brand</legend>
                {brands.map((b) => <label key={b.id} className={lbl}><input type="checkbox" name="brand" value={b.slug} defaultChecked={parsed.brands?.includes(b.slug)} className={chk} />{b.name}</label>)}</fieldset>)}
            {sizes.length > 0 && (
              <fieldset><legend className="mb-1 font-semibold">Size (in stock)</legend>
                <div className="flex flex-wrap gap-2">{sizes.map((s) => (
                  <label key={s} className="relative"><input type="checkbox" name="size" value={s} defaultChecked={parsed.sizes?.includes(s)} className="peer sr-only" />
                    <span className="tabular grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl border border-ink/30 bg-white text-sm font-bold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-sand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">{s}</span></label>))}</div></fieldset>)}
            <fieldset><legend className="mb-1 font-semibold">Price (EGP)</legend>
              <div className="flex items-center gap-2">
                <input aria-label="Minimum price" name="min" inputMode="numeric" placeholder="Min" defaultValue={parsed.min != null ? parsed.min / 100 : ""} className="min-h-11 w-full rounded-xl border border-ink/25 bg-white px-3 text-sm" />
                <span aria-hidden>–</span>
                <input aria-label="Maximum price" name="max" inputMode="numeric" placeholder="Max" defaultValue={parsed.max != null ? parsed.max / 100 : ""} className="min-h-11 w-full rounded-xl border border-ink/25 bg-white px-3 text-sm" />
              </div></fieldset>
            <fieldset><legend className="mb-1 font-semibold">Show</legend>
              <label className={lbl}><input type="checkbox" name="sale" value="1" defaultChecked={parsed.sale} className={chk} />On sale</label>
              <label className={lbl}><input type="checkbox" name="new" value="1" defaultChecked={parsed.isNew} className={chk} />New arrivals</label></fieldset>
          </div>
          <div className="flex gap-2 border-t border-ink/10 p-4">
            <Button type="submit">Show results</Button>
            {filtered && <ButtonLink href={parsed.sort !== "recommended" ? `${basePath}?sort=${parsed.sort}` : basePath} variant="outline">Clear filters</ButtonLink>}
          </div>
        </details>
      </form>

      {products.length ? (
        <>
          <ProductGrid products={products} />
          <Pagination page={page} pages={pages} hrefFor={(p) => buildShopHref(basePath, { ...parsed, brands: fixed?.brands ? [] : parsed.brands }, p)} />
        </>
      ) : (
        <EmptyState title={filtered || parsed.q ? "No products match" : "Nothing here yet"}
          action={filtered || parsed.q ? <Link href={basePath} className="font-semibold underline underline-offset-4">Clear filters</Link> : <ButtonLink href="/shop">Browse all shoes</ButtonLink>}>
          {filtered || parsed.q ? "Try removing a filter or searching for something else." : "New styles are added regularly."}
        </EmptyState>
      )}
    </div>
  );
}

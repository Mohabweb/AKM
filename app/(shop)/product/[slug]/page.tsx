import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProduct, getRelated, getSettings, getVariants, str } from "@/lib/catalog";
import { ProductView } from "@/components/shop/ProductView";
import { SizeGuide } from "@/components/shop/SizeGuide";
import { SavedProducts } from "@/components/shop/RecentlyViewed";
import { ProductGrid } from "@/components/shop/ProductCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Accordion } from "@/components/ui/Accordion";
import { Skeleton } from "@/components/ui/Skeleton";
import { JsonLd, breadcrumbLd } from "@/lib/seo";
import { abs, SITE_NAME, SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const desc = (p.description ?? `${p.name} at ${SITE_NAME}.`).replace(/\s+/g, " ").slice(0, 160);
  return {
    title: p.brand_name ? `${p.name} — ${p.brand_name}` : p.name,
    description: desc,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { type: "website", title: p.name, description: desc, url: `/product/${p.slug}` },
    twitter: { card: "summary_large_image" },
  };
}

async function Detail({ params }: Props) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();
  const [variants, settings] = await Promise.all([getVariants(p.id), getSettings()]);
  const cat = p.categories[0] ?? null;
  const inStock = variants.some((v) => v.in_stock);
  const crumbs = [{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, ...(cat ? [{ name: cat.name, path: `/category/${cat.slug}` }] : []), { name: p.name, path: `/product/${p.slug}` }];
  const ld = [
    breadcrumbLd(crumbs),
    {
      "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.id, url: abs(`/product/${p.slug}`),
      ...(p.description ? { description: p.description } : {}),
      ...(p.images.length ? { image: p.images.map((i) => (i.url.startsWith("http") ? i.url : abs(i.url))) } : {}),
      ...(p.brand_name ? { brand: { "@type": "Brand", name: p.brand_name } } : {}),
      offers: { "@type": "Offer", priceCurrency: "EGP", price: (p.price_piasters / 100).toFixed(2), url: abs(`/product/${p.slug}`),
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition" },
    },
  ];
  return (
    <>
      <JsonLd data={ld} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, ...(cat ? [{ label: cat.name, href: `/category/${cat.slug}` }] : []), { label: p.name }]} />
      <div className="mt-5">
        <ProductView id={p.id} slug={p.slug} name={p.name} brand={p.brand_name} description={p.description}
          price={p.price_piasters} original={p.original_price_piasters} onSale={p.is_on_sale} isDemo={p.is_demo}
          images={p.images} variants={variants} whatsapp={str(settings, "whatsapp_number")} siteUrl={SITE_URL}
          sizeGuide={<SizeGuide />} promoNotes={[]} />
      </div>
      <div className="mt-12 max-w-3xl">
        <Accordion items={[
          { title: "Delivery", body: str(settings, "policy_delivery") || "Delivery fee is calculated at checkout." },
          { title: "Returns & exchanges", body: str(settings, "policy_returns") },
        ]} />
      </div>
      <Suspense fallback={null}><Related id={p.id} brand={p.brand_slug} cat={cat?.slug ?? null} /></Suspense>
      <SavedProducts source="recent" exclude={p.id} title="Recently viewed" />
    </>
  );
}

async function Related({ id, brand, cat }: { id: string; brand: string | null; cat: string | null }) {
  const items = await getRelated({ id, brand_slug: brand }, cat);
  if (!items.length) return null;
  return <section className="mt-16"><h2 className="mb-6 text-3xl">You may also like</h2><ProductGrid products={items.slice(0, 4)} priorityCount={0} /></section>;
}

export default function Page(props: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Suspense fallback={<div className="grid gap-8 lg:grid-cols-2"><Skeleton className="aspect-[4/5]" /><div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-8 w-1/3" /></div></div>}>
        <Detail {...props} />
      </Suspense>
    </div>
  );
}

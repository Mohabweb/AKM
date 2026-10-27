import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBrands } from "@/lib/catalog";
import { ShopListing } from "@/components/shop/ShopListing";
import { PageHead } from "@/components/shop/PageHead";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { JsonLd, breadcrumbLd } from "@/lib/seo";
import { listingMeta, type RawParams } from "@/lib/shop-params";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };
const find = async (slug: string) => (await getBrands()).find((b) => b.slug === slug);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const b = await find((await params).slug);
  if (!b) return {};
  return listingMeta(`/brand/${b.slug}`, await searchParams, b.name, `Shop ${b.name} at AKM Luxury Shoes.`);
}
async function Body({ params, searchParams }: Props) {
  const b = await find((await params).slug);
  if (!b) notFound();
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, { name: b.name, path: `/brand/${b.slug}` }])} />
      <PageHead title={b.name} crumbs={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: b.name }]} />
      <ShopListing basePath={`/brand/${b.slug}`} params={await searchParams} fixed={{ brands: [b.slug] }} />
    </>
  );
}
export default function Page(props: Props) {
  return <div className="mx-auto max-w-7xl px-4 py-8"><Suspense fallback={<GridSkeleton />}><Body {...props} /></Suspense></div>;
}

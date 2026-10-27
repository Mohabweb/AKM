import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategories } from "@/lib/catalog";
import { ShopListing } from "@/components/shop/ShopListing";
import { PageHead } from "@/components/shop/PageHead";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { JsonLd, breadcrumbLd } from "@/lib/seo";
import { listingMeta, type RawParams } from "@/lib/shop-params";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };
const find = async (slug: string) => (await getCategories()).find((c) => c.slug === slug);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const c = await find((await params).slug);
  if (!c) return {};
  return listingMeta(`/category/${c.slug}`, await searchParams, c.name, c.description ?? `Shop ${c.name} at AKM Luxury Shoes.`);
}
async function Body({ params, searchParams }: Props) {
  const c = await find((await params).slug);
  if (!c) notFound();
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, { name: c.name, path: `/category/${c.slug}` }])} />
      <PageHead title={c.name} crumbs={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: c.name }]}>{c.description}</PageHead>
      <ShopListing basePath={`/category/${c.slug}`} params={await searchParams} fixed={{ category: c.slug }} />
    </>
  );
}
export default function Page(props: Props) {
  return <div className="mx-auto max-w-7xl px-4 py-8"><Suspense fallback={<GridSkeleton />}><Body {...props} /></Suspense></div>;
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopListing } from "@/components/shop/ShopListing";
import { PageHead } from "@/components/shop/PageHead";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { listingMeta, type RawParams } from "@/lib/shop-params";

type Props = { searchParams: Promise<RawParams> };
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return listingMeta("/shop", await searchParams, "Shop all shoes", "Browse sneakers, heels, boots, slides and more from AKM Luxury Shoes.");
}
async function Body({ searchParams }: Props) {
  return <ShopListing basePath="/shop" params={await searchParams} />;
}
export default function Page(props: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHead title="Shop" crumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
      <Suspense fallback={<GridSkeleton />}><Body {...props} /></Suspense>
    </div>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopListing } from "@/components/shop/ShopListing";
import { PageHead } from "@/components/shop/PageHead";
import { SearchBox } from "@/components/layout/SearchBox";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { parseShopParams, type RawParams } from "@/lib/shop-params";

type Props = { searchParams: Promise<RawParams> };
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

async function Body({ searchParams }: Props) {
  const p = await searchParams;
  const q = parseShopParams(p).q;
  if (!q) return <p className="text-muted">Type a shoe name or brand above to search.</p>;
  return (
    <>
      <p className="mb-4 text-muted">Results for “{q}”</p>
      <ShopListing basePath="/search" params={p} />
    </>
  );
}
export default function Page(props: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHead title="Search" crumbs={[{ label: "Home", href: "/" }, { label: "Search" }]} />
      <div className="mb-8 max-w-xl"><SearchBox /></div>
      <Suspense fallback={<GridSkeleton />}><Body {...props} /></Suspense>
    </div>
  );
}

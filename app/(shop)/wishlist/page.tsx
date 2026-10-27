import type { Metadata } from "next";
import { PageHead } from "@/components/shop/PageHead";
import { SavedProducts } from "@/components/shop/RecentlyViewed";
import { WishlistEmpty } from "@/components/shop/WishlistEmpty";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHead title="Your wishlist" crumbs={[{ label: "Home", href: "/" }, { label: "Wishlist" }]}>Saved on this device only.</PageHead>
      <SavedProducts source="wishlist" limit={24} />
      <WishlistEmpty />
    </div>
  );
}

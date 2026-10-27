"use client";
import { toggleWish, useWishlist } from "@/lib/client/lists";
import { HeartIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export function WishlistButton({ productId, name, className }: { productId: string; name: string; className?: string }) {
  const on = useWishlist().includes(productId);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={() => toggleWish(productId)}
      className={cn("grid size-11 place-items-center rounded-full bg-white/90 text-ink shadow-sm hover:bg-white", on && "text-danger", className)}>
      <HeartIcon filled={on} />
    </button>
  );
}

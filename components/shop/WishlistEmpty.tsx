"use client";
import { useWishlist } from "@/lib/client/lists";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
export function WishlistEmpty() {
  return useWishlist().length ? null : <EmptyState title="Nothing saved yet" action={<ButtonLink href="/shop">Browse shoes</ButtonLink>}>Tap the heart on any shoe to save it here.</EmptyState>;
}

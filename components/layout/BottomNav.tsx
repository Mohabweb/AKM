"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BagIcon, GridIcon, HeartIcon, HomeIcon, SearchIcon } from "@/components/icons";
import { cartCount, useCart } from "@/lib/client/cart";
import { cn } from "@/lib/cn";

export function BottomNav() {
  const path = usePathname();
  const n = cartCount(useCart());
  const items = [
    { href: "/", label: "Home", Icon: HomeIcon },
    { href: "/shop", label: "Shop", Icon: GridIcon },
    { href: "/search", label: "Search", Icon: SearchIcon },
    { href: "/wishlist", label: "Saved", Icon: HeartIcon },
    { href: "/cart", label: "Cart", Icon: BagIcon, badge: n },
  ];
  return (
    <nav aria-label="Quick links" className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/15 bg-sand/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, Icon, badge }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active ? "text-teal-700" : "text-ink")}>
                <Icon width={22} height={22} />{label}
                {!!badge && <span className="tabular absolute right-[28%] top-1.5 grid min-w-4 place-items-center rounded-full bg-teal-600 px-1 text-[10px] font-bold leading-4 text-white">{badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

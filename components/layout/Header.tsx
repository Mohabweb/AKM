import Link from "next/link";
import { getCategories } from "@/lib/catalog";
import { Logo } from "@/components/Logo";
import { MenuIcon, HeartIcon } from "@/components/icons";
import { SearchBox } from "./SearchBox";
import { CartButton } from "./CartButton";
import { WishlistCount } from "./WishlistCount";

export async function Header() {
  const cats = (await getCategories()).filter((c) => !c.parent_id).slice(0, 8);
  const links = [{ href: "/shop?new=1", label: "New" }, ...cats.map((c) => ({ href: `/category/${c.slug}`, label: c.name })), { href: "/shop?sale=1", label: "Sale" }];
  return (
    <header className="sticky top-0 z-30 border-b border-ink/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 lg:gap-8">
        <details className="relative lg:hidden">
          <summary aria-label="Menu" className="grid size-11 cursor-pointer list-none place-items-center rounded-full hover:bg-ink/5 [&::-webkit-details-marker]:hidden"><MenuIcon /></summary>
          <nav aria-label="Main" className="absolute left-0 top-full z-40 mt-2 w-64 rounded-2xl border border-ink/15 bg-white p-2 shadow-xl">
            {links.map((l) => <Link key={l.href} href={l.href} className="flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-sand">{l.label}</Link>)}
            <Link href="/track" className="flex min-h-11 items-center rounded-xl px-3 hover:bg-sand">Track an order</Link>
          </nav>
        </details>
        <Link href="/" aria-label="AKM Luxury Shoes — home" className="shrink-0"><Logo className="h-9 w-auto" /></Link>
        <nav aria-label="Main" className="hidden items-center gap-5 lg:flex">
          {links.map((l) => <Link key={l.href} href={l.href} className="mono whitespace-nowrap text-[11px] text-ink hover:text-teal-700">{l.label}</Link>)}
        </nav>
        <div className="ml-auto hidden w-full max-w-sm md:block"><SearchBox /></div>
        <div className="ml-auto flex items-center md:ml-0">
          <Link href="/wishlist" aria-label="Wishlist" className="relative hidden size-11 place-items-center rounded-full hover:bg-ink/5 sm:grid"><HeartIcon /><WishlistCount /></Link>
          <CartButton />
          <Link href="/shop" className="mono ml-2 hidden min-h-11 items-center rounded-full bg-lime px-5 text-[11px] font-bold text-ink hover:bg-lime-2 lg:inline-flex">Shop now</Link>
        </div>
      </div>
      <div className="px-4 pb-2 md:hidden"><SearchBox /></div>
    </header>
  );
}

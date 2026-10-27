import Link from "next/link";
import { getSettings, str } from "@/lib/catalog";
import { Logo } from "@/components/Logo";
import { cacheLife } from "next/cache";

async function year() { "use cache"; cacheLife("days"); return new Date().getFullYear(); }

export async function Footer() {
  const s = await getSettings();
  const phone = str(s, "contact_phone"), email = str(s, "contact_email"), addr = str(s, "store_address");
  const social = [["Instagram", str(s, "social_instagram")], ["TikTok", str(s, "social_tiktok")], ["Facebook", str(s, "social_facebook")]].filter(([, u]) => u);
  const col = "space-y-2 text-sm";
  return (
    <footer className="mt-20 bg-ink text-sand">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="inline-block rounded-lg bg-sand p-2"><Logo className="h-8 w-auto" /></div>
          {addr && <p className="mt-4 text-sm text-sand/80">{addr}{str(s, "store_postal_code") && `, ${str(s, "store_postal_code")}`}</p>}
          {phone && <p className="mt-1 text-sm"><a href={`tel:${phone}`} className="underline underline-offset-4">{phone}</a></p>}
          {email && <p className="mt-1 text-sm"><a href={`mailto:${email}`} className="underline underline-offset-4">{email}</a></p>}
        </div>
        <nav aria-label="Shop"><h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-sans)" }}>Shop</h2>
          <ul className={col}><li><Link href="/shop">All shoes</Link></li><li><Link href="/shop?new=1">New arrivals</Link></li><li><Link href="/shop?sale=1">Sale</Link></li><li><Link href="/wishlist">Wishlist</Link></li></ul></nav>
        <nav aria-label="Help"><h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-sans)" }}>Help</h2>
          <ul className={col}><li><Link href="/track">Track your order</Link></li><li><Link href="/contact">Contact</Link></li><li><Link href="/shipping">Shipping</Link></li><li><Link href="/returns">Returns &amp; exchanges</Link></li><li><Link href="/payment">Payment methods</Link></li></ul></nav>
        <nav aria-label="Legal and social"><h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-sans)" }}>Legal</h2>
          <ul className={col}><li><Link href="/privacy">Privacy policy</Link></li><li><Link href="/terms">Terms of sale</Link></li></ul>
          {social.length > 0 && <ul className="mt-5 flex flex-wrap gap-4 text-sm">{social.map(([n, u]) => <li key={n}><a href={u} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{n}</a></li>)}</ul>}
        </nav>
      </div>
      <p className="border-t border-sand/15 px-4 py-5 text-center text-xs text-sand/70">© {await year()} AKM Luxury Shoes. Prices in Egyptian pounds (EGP).</p>
    </footer>
  );
}

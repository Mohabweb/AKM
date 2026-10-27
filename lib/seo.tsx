import { headers } from "next/headers";
import { abs, SITE_NAME } from "@/lib/site";
import { str, type Settings } from "@/lib/catalog";

/** Renders JSON-LD. `<` is escaped so data can never close the script tag. Carries the CSP nonce when the proxy set one. */
export async function JsonLd({ data }: { data: object | object[] }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const json = JSON.stringify(Array.isArray(data) ? data : [data]).replace(/</g, "\\u003c");
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />;
}

const sameAs = (s: Settings) => ["social_instagram", "social_tiktok", "social_facebook"].map((k) => str(s, k)).filter(Boolean);

export const organizationLd = (s: Settings) => ({
  "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: abs("/"), logo: abs("/logo.svg"),
  ...(sameAs(s).length ? { sameAs: sameAs(s) } : {}),
  ...(str(s, "contact_email") ? { email: str(s, "contact_email") } : {}),
});
export const websiteLd = () => ({
  "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: abs("/"),
  potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: abs("/search?q={search_term_string}") }, "query-input": "required name=search_term_string" },
});
export const localBusinessLd = (s: Settings) => ({
  "@context": "https://schema.org", "@type": "ShoeStore", name: SITE_NAME, url: abs("/"),
  ...(str(s, "store_address") ? { address: { "@type": "PostalAddress", streetAddress: str(s, "store_address"), postalCode: str(s, "store_postal_code") || undefined, addressLocality: "Alexandria", addressCountry: "EG" } } : {}),
  ...(str(s, "contact_phone") ? { telephone: str(s, "contact_phone") } : {}),
});
export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
});

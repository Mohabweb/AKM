import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";

/** Only /admin and /api are blocked from crawling. Cart/checkout/search/etc. stay crawlable ON PURPOSE so crawlers can
 *  see their `noindex` meta tag (a robots.txt block would hide it and the URL could still be listed). */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }], sitemap: abs("/sitemap.xml") };
}

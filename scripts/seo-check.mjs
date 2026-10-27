// Usage: node scripts/seo-check.mjs http://localhost:3000
// Fetches the sitemap and key pages from a RUNNING server, parses <head> and JSON-LD, prints pass/fail per check.
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
let failed = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) failed++; };
const get = async (p) => { const r = await fetch(base + p, { redirect: "manual" }); return { status: r.status, text: await r.text(), headers: r.headers }; };
const meta = (h, re) => (h.match(re) ?? [])[1];

const sm = await get("/sitemap.xml");
ok(sm.status === 200 && sm.text.includes("<urlset"), "sitemap.xml is valid-looking XML");
const urls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const bad of ["/cart", "/checkout", "/admin", "/search", "/order/", "/track"]) ok(!urls.some((u) => u.includes(bad)), `sitemap excludes ${bad}`);
const rb = await get("/robots.txt");
ok(/Disallow: \/admin/.test(rb.text) && /Sitemap:/.test(rb.text), "robots.txt blocks /admin and lists the sitemap");

const sample = ["/", "/shop", ...urls.map((u) => new URL(u).pathname).filter((p) => /^\/(product|category|brand)\//.test(p)).slice(0, 6), "/privacy", "/terms", "/returns", "/shipping", "/payment", "/contact"];
for (const p of [...new Set(sample)]) {
  const { status, text } = await get(p);
  ok(status === 200, `${p} → 200`);
  const title = meta(text, /<title>([^<]*)<\/title>/);
  ok(!!title && title.length <= 70, `${p} has a title (≤70 chars): ${title}`);
  ok(!!meta(text, /<meta name="description" content="([^"]+)"/), `${p} has a meta description`);
  ok(!!meta(text, /<link rel="canonical" href="([^"]+)"/), `${p} has a canonical`);
  ok(!!meta(text, /<meta property="og:title" content="([^"]+)"/), `${p} has og:title`);
  if (p.startsWith("/product/")) ok(/property="og:image"/.test(text), `${p} has og:image`);
  const blocks = [...text.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const nodes = [];
  for (const b of blocks) { try { const j = JSON.parse(b.replace(/\\u003c/g, "<")); nodes.push(...(Array.isArray(j) ? j : [j])); } catch { ok(false, `${p} JSON-LD block does not parse`); } }
  const types = nodes.map((n) => n["@type"]);
  if (p === "/") for (const t of ["Organization", "WebSite", "ShoeStore"]) ok(types.includes(t), `/ has ${t} JSON-LD`);
  if (p.startsWith("/product/")) {
    const pr = nodes.find((n) => n["@type"] === "Product");
    ok(!!pr && !!pr.name && pr.offers?.priceCurrency === "EGP" && /^\d+\.\d{2}$/.test(pr.offers?.price ?? ""), `${p} Product+Offer has name, EGP price`);
    ok(types.includes("BreadcrumbList"), `${p} has BreadcrumbList`);
  }
}
for (const p of ["/cart", "/checkout", "/search?q=a", "/wishlist", "/track"]) {
  const { text } = await get(p);
  ok(/<meta name="robots" content="[^"]*noindex/.test(text), `${p} is noindex`);
}
ok((await get("/definitely-not-a-page")).status === 404, "unknown URL returns 404");
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);

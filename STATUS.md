# AKM Luxury Shoes — build status

## Done and tested (backend, from the first session) (65 automated tests pass: `npm test`, needs local Postgres, see scripts/db-reset.sh)
- Next.js 16 (App Router, `proxy.ts` not middleware, `cacheComponents` on) + TS strict + Tailwind 4 + Zod. Read `node_modules/next/dist/docs/` before writing Next code: this version differs from older docs.
- Env validation (`lib/env.ts`, `lib/env.server.ts`), `.env.example`, security headers (partial), money (integer piasters), validation (EG phone, order number, checkout schema).
- Database, 6 migrations + seed (`db/`): all 19 required tables + `rate_limits`; RLS on every table; deny-by-default grants; owner vs staff policies; private receipts bucket / public images bucket; audit triggers; last-owner guard.
- Server-side commerce in SQL: `_price_cart` (single pricing path for quote + order), `quote_cart`, `create_order` (idempotency via advisory lock, row locks in id order, stock decrement, coupons, shipping, snapshots), order status machine with restock on cancel, InstaPay receipt attach/review, expiry job, `track_order` (no PII), `delete_demo_data`, DB-backed rate limiter.
- Seed: settings, 27 governorates (placeholder fee EGP 60, owner must review), 8 categories, 6 labelled demo products, default homepage layout.
- API routes: `/api/quote`, `/api/checkout`, `/api/track`, `/api/search`, `/api/receipt` (magic-byte sniffing, private bucket), `/api/webhooks/paymob` (HMAC + amount check + idempotent), `/api/cron/expire-orders`. Turnstile verify + rate limits.
- Paymob client + HMAC verification written from Paymob docs. NOT run against Paymob (no credentials).
- Auth helpers (`lib/auth.ts`, `proxy.ts`) written, not yet exercised end-to-end.


## Added in session 2 (compiles + `next build` passes; NOT yet exercised in a browser)
- Design system: tokens in `app/globals.css` (teal/ink/sand, AA-checked: buttons use teal-600 #0E7C89, links teal-700), self-hosted fonts in `app/fonts` (Fraunces, Gloock, Manrope), motion policy (`[data-flow]` kills all animation; `prefers-reduced-motion` honoured).
- UI kit `components/ui`: Button, Field/Input/Select/Textarea, Badge, Price, Skeleton, EmptyState, Breadcrumbs, Pagination, Accordion (native details), Tabs, SizeChip, Drawer/BottomSheet (native dialog), Toast, AnnouncementBar. Layout: Header, Footer, SearchBox, MiniCart, CartButton, BottomNav, WishlistCount.
- Data layer `lib/catalog.ts` (`use cache` + tags `catalog`/`settings`/`homepage`), client stores (cart/wishlist/recent in localStorage, validated), `lib/shop-params.ts`, `lib/seo.tsx`.
- Storefront pages (`app/(shop)`): home (homepage_sections, empty sections hidden), shop, category, brand, product (gallery, live sizes, sticky add-to-cart, size guide, related, recently viewed, share, WhatsApp from settings), search, wishlist.
- Flow pages (`app/(flow)`, no motion): cart, checkout, order confirmation, track + `components/flow/*`; `/api/products`.
- Demo images (`public/demo`, `scripts/gen-demo-images.mjs`), stand-in wordmark `public/logo.svg` + `app/icon.svg` generated from Gloock. **The real retro AKM logo was never attached — replace both.**
- Local test backend `scripts/local-backend/` (PostgREST + gateway with a MOCK of Supabase Auth/TOTP/Storage). Start: `POSTGREST_BIN=<path> bash scripts/local-backend/start.sh`, keys from `node scripts/local-backend/jwt.mjs`. This does NOT prove real Supabase Auth/Storage behaviour. `db/test/bootstrap.sql` auth.uid() now also reads `request.jwt.claims`.
- Verified this session: `npm test` 65/65 pass; `tsc` clean; `next build` passes (fixed BottomNav needing Suspense).

## NOT done (nothing below was started unless stated)
- Not verified: no page has been opened in a browser; no screenshots, no a11y/Lighthouse, no checkout run end-to-end. /design preview page not built. Confirm the flow pages implement: idempotency key once per attempt, InstaPay number + receipt upload, card-not-configured message, no popups/timers.
- Admin (everything: login, TOTP/aal2, lockout, dashboard, products, orders, settings, staff, audit, delete-demo-data). `proxy.ts` still only does the session refresh + /admin redirect.
- Bulk + CSV tools. Promotions engine (migration 0007+, `_price_cart` extension, offer popup/countdown). SEO completion (sitemap, robots, OG image, favicons check, 404/500, JSON-LD audit) + legal drafts. Security hardening (CSP nonces, HSTS, Origin checks, Dependabot, gitleaks, security tests). Playwright E2E + Lighthouse. README/docs/admin guide/security report.
- Decision pending for CSP: nonces force dynamic rendering of every page (conflicts with the current partial-prerender build). Try nonce CSP with each page's dynamic part under Suspense and check for violations in a real browser; fall back to experimental SRI if needed; document the trade-off.
- Known gaps from before: promo types beyond % offers; cancelled orders do not release single-use coupons; `is_admin()` should require aal2 at DB level (tests' `as()` helper would then need an aal claim).

## Session 3 — "Aeline" look (homepage first)  [NOT compiled or viewed: no node_modules/network in this environment]
Design note: light, tight-tracked Manrope display (weight 500, -0.045em), mono uppercase labels (system mono stack; swap for a self-hosted mono font later), white page, sky-blue gradient hero card with rounded-3xl, lime #D4FB52 as the action colour, ink for contrast cards, mist grey cards. Teal stays the brand colour for links/focus/product UI.
Changed: `app/globals.css` (sky/lime tokens, `.sky`, `.fan`, `.mono`, `.display-tight`, float keyframes), `components/shop/HomeSections.tsx` (hero with floating tilted tiles built from real products + info tiles, logo-style marquee, section headings, bento "About us" in place of trust_bar), `components/layout/Header.tsx` (white bar, mono nav, lime Shop now), `app/(shop)/layout.tsx` (white background).
Not done: product card/page, footer, mobile menu restyle in the same language; /design page; any browser/Lighthouse check. Run `npm ci && npx tsc --noEmit && npm run build` first and fix any type errors.

## Prompt 2 (flow pages) — static review only, NOT run
No Postgres/Chromium/Playwright/network in the session-3 environment, so none of the Prompt 2 scenarios were executed.
Reviewed by reading code: idempotency key is created once per attempt (sessionStorage, cleared after success) and `busy` guards double submit, DB also replays by key; card with Paymob unconfigured disables the submit button and the API returns `cardUnavailable`; no timers/popups found in components/flow.
Changed: CheckoutForm now has a fixed bottom Total + Place order bar on phones (desktop keeps the sticky summary); error focus targets `co-form` / `co-paymentMethod` now exist (they did not before, so focus never moved).
Still to run: all scenarios in the Prompt 2 list, plus `tests/e2e/flow-no-motion.spec.ts` (computed animation/transition = none, no open dialogs, no horizontal overflow at 360px).

## Prompt 7 (SEO + legal) — written, NOT compiled, NOT fetched (no node_modules/network/server in this environment)
Added: `app/sitemap.ts`, `app/robots.ts` (blocks only /admin and /api so noindex tags stay visible), `app/manifest.ts`, `app/apple-icon.tsx` (placeholder AKM-on-teal; replace with the real logo), `app/(shop)/product/[slug]/opengraph-image.tsx` (the old explicit og:image URL pointed at a route that did not exist; removed so the file convention attaches itself), branded `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, X-Robots-Tag noindex on /admin, legal pages `/privacy /terms /returns /shipping /payment /contact` (`lib/legal.ts` + `app/(shop)/[legal]/page.tsx`). The footer already linked to these; before this they were all 404.
Existing and kept: metadata + canonicals on listing/product pages, noindex on cart/checkout/order/track/search/wishlist and filtered listings, JSON-LD (Organization, WebSite+SearchAction, ShoeStore, BreadcrumbList, Product+Offer). No analytics/pixels exist in the code, so no consent banner was added; the privacy page says so and promises consent-first if any are added.
Legal drafts carry "DRAFT — requires professional legal review" and [bracketed] gaps (legal entity, retention, delivery times, return window). Law 151/2020 and Law 181/2018 are named but the details need a lawyer.
Known gaps: favicon is the stand-in wordmark; Organization logo is an SVG (Google prefers PNG/JPG); product OG type is "website"; `[legal]` root segment and `ImageResponse` usage unverified on this Next 16 build; "Delivery fee" wording on the shipping page assumes the owner fills the bracketed items.
To verify: `npm run build && npm start`, then `node scripts/seo-check.mjs http://localhost:3000`, and paste the homepage and a product URL into Google's Rich Results Test.

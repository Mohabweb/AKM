import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSettings, str } from "@/lib/catalog";
import { DRAFT_NOTICE, LEGAL_SLUGS, legalDoc, type LegalCtx, type LegalSlug } from "@/lib/legal";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd, breadcrumbLd } from "@/lib/seo";

type Props = { params: Promise<{ legal: string }> };
const isSlug = (s: string): s is LegalSlug => (LEGAL_SLUGS as readonly string[]).includes(s);
export function generateStaticParams() { return LEGAL_SLUGS.map((legal) => ({ legal })); }

async function ctx(): Promise<LegalCtx> {
  const s = await getSettings();
  const pm = (s.payment_methods_enabled ?? {}) as Record<string, boolean>;
  const t = (k: string) => str(s, k);
  return {
    instapay: t("instapay_number"), address: t("store_address"), postal: t("store_postal_code"), phone: t("contact_phone"), email: t("contact_email"), whatsapp: t("whatsapp_number"),
    social: ([["Instagram", t("social_instagram")], ["TikTok", t("social_tiktok")], ["Facebook", t("social_facebook")]] as [string, string][]).filter(([, u]) => u),
    cod: !!pm.cod, card: !!pm.card, instapayOn: !!pm.instapay,
    storeText: { privacy: t("policy_privacy"), terms: t("policy_terms"), returns: t("policy_returns"), shipping: t("policy_delivery") },
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).legal;
  if (!isSlug(slug)) return {};
  const d = legalDoc(slug, { instapay: "", address: "", postal: "", phone: "", email: "", whatsapp: "", social: [], cod: false, card: false, instapayOn: false, storeText: {} });
  return { title: d.title, description: d.description, alternates: { canonical: `/${slug}` } };
}

async function Body({ params }: Props) {
  const slug = (await params).legal;
  if (!isSlug(slug)) notFound();
  const d = legalDoc(slug, await ctx());
  const draft = slug !== "contact" && slug !== "payment";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: d.title, path: `/${slug}` }])} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: d.title }]} />
      <h1 className="display-tight mt-6 text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-sans)" }}>{d.title}</h1>
      {draft && <p role="note" className="mono mt-4 rounded-xl bg-warn-50 px-4 py-3 text-[11px] font-bold text-warn">{DRAFT_NOTICE}</p>}
      {d.sections.map((x) => (
        <section key={x.h} className="mt-8">
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}>{x.h}</h2>
          {x.p.map((t, i) => <p key={i} className="mt-2 leading-relaxed text-ink-2">{t}</p>)}
        </section>
      ))}
      {d.storeText && (
        <section className="mt-8 rounded-2xl bg-mist p-5">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}>Store note</h2>
          <p className="mt-2 whitespace-pre-line text-ink-2">{d.storeText}</p>
        </section>
      )}
    </div>
  );
}
export default function Page(props: Props) { return <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-16" />}><Body {...props} /></Suspense>; }

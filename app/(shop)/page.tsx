import { Suspense } from "react";
import type { Metadata } from "next";
import { getHomepage, getSettings } from "@/lib/catalog";
import { HomeSections } from "@/components/shop/HomeSections";
import { EmptyState } from "@/components/ui/EmptyState";
import { JsonLd, organizationLd, websiteLd, localBusinessLd } from "@/lib/seo";
import { GridSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { alternates: { canonical: "/" } };

async function Home() {
  const [sections, settings] = await Promise.all([getHomepage(), getSettings()]);
  return (
    <>
      <JsonLd data={[organizationLd(settings), websiteLd(), localBusinessLd(settings)]} />
      {sections.length ? <HomeSections sections={sections} settings={settings} /> : <div className="px-4 py-24"><EmptyState title="Our new collection is on its way">Check back soon.</EmptyState></div>}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16"><GridSkeleton /></div>}><Home /></Suspense>;
}

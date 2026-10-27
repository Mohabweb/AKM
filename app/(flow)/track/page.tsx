import { Suspense } from "react";
import type { Metadata } from "next";
import { TrackOrder } from "@/components/flow/TrackOrder";
import { getSettings, str } from "@/lib/catalog";

export const metadata: Metadata = { title: "Track your order", robots: { index: false, follow: true } };
async function Body() {
  const s = await getSettings();
  return <TrackOrder instapayNumber={str(s, "instapay_number")} instapayName={str(s, "instapay_account_name")} />;
}
export default function Page() {
  return <><h1 className="mb-8 text-center text-4xl">Track your order</h1><Suspense fallback={<p>Loading…</p>}><Body /></Suspense></>;
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { TrackOrder } from "@/components/flow/TrackOrder";
import { getSettings, str } from "@/lib/catalog";
import { orderNumberSchema } from "@/lib/validation";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false, follow: false } };

async function Body({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ card?: string }> }) {
  const n = orderNumberSchema.safeParse((await params).number);
  if (!n.success) notFound();
  const s = await getSettings();
  return <TrackOrder initialNumber={n.data} confirmation instapayNumber={str(s, "instapay_number")} instapayName={str(s, "instapay_account_name")} cardNotice={(await searchParams).card === "unavailable"} />;
}
export default function Page(props: { params: Promise<{ number: string }>; searchParams: Promise<{ card?: string }> }) {
  return <><h1 className="mb-8 text-4xl">Your order</h1><Suspense fallback={<p>Loading…</p>}><Body {...props} /></Suspense></>;
}

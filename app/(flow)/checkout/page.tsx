import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckoutForm } from "@/components/flow/CheckoutForm";
import { getSettings, getShippingZones, str } from "@/lib/catalog";
import { getPaymentOptions } from "@/lib/payments/options";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

async function Form() {
  const [zones, options, s] = await Promise.all([getShippingZones(), getPaymentOptions(), getSettings()]);
  return <CheckoutForm zones={zones} options={options} instapayNumber={str(s, "instapay_number")} />;
}
export default function Page() {
  return (
    <>
      <h1 className="mb-8 text-4xl">Checkout</h1>
      <Suspense fallback={<p>Loading checkout…</p>}><Form /></Suspense>
    </>
  );
}

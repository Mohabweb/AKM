import type { Metadata } from "next";
import { CartView } from "@/components/flow/CartView";
export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };
export default function Page() {
  return <><h1 className="mb-8 text-4xl">Your cart</h1><CartView /></>;
}

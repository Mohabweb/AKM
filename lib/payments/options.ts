import "server-only";
import { getSettings } from "@/lib/catalog";
import { paymobConfigured } from "./paymob";

export type PaymentOptions = { cod: boolean; instapay: boolean; card: boolean; cardConfigured: boolean };

/** Methods the owner enabled in settings. `cardConfigured` is false until the Paymob env vars exist, so the UI can say so plainly. */
export async function getPaymentOptions(): Promise<PaymentOptions> {
  const s = await getSettings();
  const pm = (s.payment_methods_enabled ?? {}) as Record<string, boolean>;
  return { cod: pm.cod === true, instapay: pm.instapay === true, card: pm.card === true, cardConfigured: paymobConfigured() };
}

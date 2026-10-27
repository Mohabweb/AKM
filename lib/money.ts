/** All money is integer piasters (1 EGP = 100). Never use floats for arithmetic. */
export type Piasters = number;

export const egp = (pt: Piasters) => Math.round(pt);

const fmt = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});
const fmtDec = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", minimumFractionDigits: 2 });

export function formatEGP(pt: Piasters): string {
  return pt % 100 === 0 ? fmt.format(pt / 100) : fmtDec.format(pt / 100);
}

/** "1,250.50" or "1250" -> piasters, or null when invalid. Parses text, no float math. */
export function parseEGP(input: string): Piasters | null {
  const m = input.trim().replace(/,/g, "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
}

/** Integer percent off, rounded to nearest piaster, half up. */
export function percentOff(original: Piasters, price: Piasters): number {
  if (original <= 0 || price >= original) return 0;
  return Math.round(((original - price) * 100) / original);
}

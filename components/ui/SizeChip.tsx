import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function SizeChip({ label, selected, soldOut, note, className, ...p }: { label: string; selected?: boolean; soldOut?: boolean; note?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" role="radio" aria-checked={!!selected} disabled={soldOut} aria-label={`Size ${label}${soldOut ? ", sold out" : note ? `, ${note}` : ""}`}
      className={cn(
        "relative min-h-11 min-w-12 rounded-xl border px-3 text-sm font-bold tabular",
        selected ? "border-ink bg-ink text-sand" : "border-ink/30 bg-white hover:border-ink",
        soldOut && "cursor-not-allowed border-dashed border-ink/20 bg-transparent text-muted line-through opacity-70 hover:border-ink/20",
        className,
      )} {...p}>
      {label}
    </button>
  );
}

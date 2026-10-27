import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  teal: "bg-teal-600 text-white",
  ink: "bg-ink text-sand",
  sand: "bg-sand-2 text-ink",
  ok: "bg-ok-50 text-ok",
  warn: "bg-warn-50 text-warn",
  danger: "bg-danger-50 text-danger",
} as const;

export function Badge({ tone = "sand", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider", tones[tone], className)}>{children}</span>;
}

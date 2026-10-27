import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "dark" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export const buttonClass = (variant: Variant = "primary", size: Size = "md", full = false) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide select-none",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    "transition-colors",
    size === "sm" && "min-h-9 px-4 text-sm",
    size === "md" && "min-h-11 px-6 text-sm",
    size === "lg" && "min-h-12 px-8 text-base",
    full && "w-full",
    variant === "primary" && "bg-teal-600 text-white hover:bg-teal-700",
    variant === "dark" && "bg-ink text-sand hover:bg-ink-2",
    variant === "outline" && "border border-ink/30 bg-transparent text-ink hover:border-ink hover:bg-white",
    variant === "ghost" && "text-ink hover:bg-ink/5",
    variant === "danger" && "bg-danger text-white hover:bg-red-800",
  );

type Common = { variant?: Variant; size?: Size; full?: boolean };

export function Button({ variant, size, full, className, type = "button", ...p }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn(buttonClass(variant, size, full), className)} {...p} />;
}

export function ButtonLink({ variant, size, full, className, ...p }: Common & ComponentProps<typeof Link>) {
  return <Link className={cn(buttonClass(variant, size, full), className)} {...p} />;
}

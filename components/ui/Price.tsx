import { formatEGP, percentOff } from "@/lib/money";
import { cn } from "@/lib/cn";

/** Shows the price the customer pays. The strikethrough/“% off” appear only when the database says the item is discounted. */
export function Price({ price, original, size = "md", className }: { price: number; original?: number | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const off = original && original > price ? percentOff(original, price) : 0;
  return (
    <p className={cn("tabular flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-bold", size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base")}>
        <span className="sr-only">Price: </span>{formatEGP(price)}
      </span>
      {off > 0 && (
        <>
          <s className={cn("text-muted", size === "lg" ? "text-base" : "text-xs")}><span className="sr-only">Was: </span>{formatEGP(original!)}</s>
          <span className={cn("font-semibold text-teal-700", size === "lg" ? "text-sm" : "text-xs")}>{off}% off</span>
        </>
      )}
    </p>
  );
}

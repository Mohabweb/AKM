import Link from "next/link";
import { cn } from "@/lib/cn";

/** Server-rendered, link-based pagination (works without JS, crawlable). `hrefFor(page)` builds the URL with current filters. */
export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const list = [...set].sort((a, b) => a - b);
  const item = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-semibold";
  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && <Link rel="prev" href={hrefFor(page - 1)} className={cn(item, "border border-ink/25 hover:bg-white")}>Previous</Link>}
      {list.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - list[i - 1] > 1 && <span aria-hidden className="px-1 text-muted">…</span>}
          <Link href={hrefFor(p)} aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-ink text-sand" : "border border-ink/25 hover:bg-white")}>
            <span className="sr-only">Page </span>{p}
          </Link>
        </span>
      ))}
      {page < pages && <Link rel="next" href={hrefFor(page + 1)} className={cn(item, "border border-ink/25 hover:bg-white")}>Next</Link>}
    </nav>
  );
}

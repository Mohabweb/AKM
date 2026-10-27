import Link from "next/link";
export type Crumb = { label: string; href?: string };
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {c.href && i < items.length - 1 ? <Link href={c.href} className="underline-offset-4 hover:text-ink hover:underline">{c.label}</Link>
              : <span aria-current={i === items.length - 1 ? "page" : undefined} className={i === items.length - 1 ? "text-ink" : ""}>{c.label}</span>}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

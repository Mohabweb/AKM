import type { ReactNode } from "react";

/** Native <details>: keyboard + screen-reader accessible, no JS, no animation. */
export function Accordion({ items }: { items: { title: string; body: ReactNode; open?: boolean }[] }) {
  return (
    <div className="divide-y divide-ink/15 border-y border-ink/15">
      {items.map((it) => (
        <details key={it.title} open={it.open} className="group py-1">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
            {it.title}
            <span aria-hidden className="text-xl leading-none transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="pb-4 text-sm leading-relaxed text-ink-2">{it.body}</div>
        </details>
      ))}
    </div>
  );
}

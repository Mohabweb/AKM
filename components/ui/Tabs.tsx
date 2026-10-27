"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** WAI-ARIA tabs with arrow-key navigation. */
export function Tabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const uid = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const t = tabs[(i + d + tabs.length) % tabs.length];
    setActive(t.id);
    refs.current[t.id]?.focus();
  };
  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-ink/15">
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} role="tab" type="button" id={`${uid}-t-${t.id}`}
            aria-selected={active === t.id} aria-controls={`${uid}-p-${t.id}`} tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)} onKeyDown={(e) => onKey(e, i)}
            className={cn("min-h-11 px-4 text-sm font-semibold -mb-px border-b-2", active === t.id ? "border-teal-600 text-ink" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${uid}-p-${t.id}`} aria-labelledby={`${uid}-t-${t.id}`} hidden={active !== t.id} className="pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}

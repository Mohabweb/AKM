"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Native <dialog>: focus trap, Esc to close and inert background come from the browser. `side="bottom"` = bottom sheet.
 *  Pass animated={false} where motion is not allowed (mini cart, checkout). */
export function Drawer({ open, onClose, title, side = "right", animated = true, children }: {
  open: boolean; onClose: () => void; title: string; side?: "right" | "bottom"; animated?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-label={title} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cn(
        "m-0 max-h-none border-0 bg-sand p-0 text-ink shadow-2xl backdrop:bg-ink/55",
        side === "right" ? "ml-auto h-dvh w-[min(26rem,100vw)]" : "mt-auto w-full max-h-[88dvh] rounded-t-2xl",
        animated && (side === "right" ? "drawer-anim" : "sheet-anim"),
      )}>
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className="flex items-center justify-between border-b border-ink/15 px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="grid size-11 place-items-center rounded-full hover:bg-ink/5">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{open && children}</div>
      </div>
    </dialog>
  );
}

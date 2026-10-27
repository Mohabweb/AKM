import type { ReactNode } from "react";
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-dashed border-ink/25 bg-white/60 px-6 py-14 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children && <p className="mt-2 text-muted">{children}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

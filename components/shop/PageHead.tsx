import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
export function PageHead({ title, crumbs, children }: { title: string; crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 text-4xl sm:text-5xl">{title}</h1>
      {children && <p className="mt-2 max-w-2xl text-muted">{children}</p>}
    </div>
  );
}

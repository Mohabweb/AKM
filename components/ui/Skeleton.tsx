import { cn } from "@/lib/cn";
export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn("skeleton", className)} />;
export function GridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div role="status" aria-label="Loading products" className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <div key={i}><Skeleton className="aspect-[4/5] w-full" /><Skeleton className="mt-3 h-4 w-3/4" /><Skeleton className="mt-2 h-4 w-1/3" /></div>
      ))}
    </div>
  );
}

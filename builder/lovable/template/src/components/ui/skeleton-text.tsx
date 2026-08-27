import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
/** Placeholder lines. The last is short, because real paragraphs end mid-line. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div data-slot="skeleton-text" className={cn("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

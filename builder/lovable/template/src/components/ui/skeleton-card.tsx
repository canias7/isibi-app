import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { cn } from "@/lib/utils";
/** A card-shaped placeholder, so a grid does not reflow when the data lands. */
export function SkeletonCard({ media = true, className }: { media?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4", className)} aria-hidden="true">
      {media && <Skeleton className="aspect-[4/3] w-full rounded-lg" />}
      <Skeleton className="h-4 w-1/2" />
      <SkeletonText lines={2} />
    </div>
  );
}

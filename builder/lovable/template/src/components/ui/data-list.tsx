import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * The four states of a list, once.
 *
 * This is the single most repeated code in every generated site: GENERATOR.md
 * requires loading, error, empty and loaded on EVERY list, and the model
 * hand-writes all four every time, on every page. Getting one wrong is invisible
 * until a visitor hits it.
 *
 * Takes the query object shape that @tanstack/react-query returns, so a page can
 * hand `useRows(...)` straight over — but typed structurally rather than imported,
 * so this component does not depend on the data layer.
 */
export function DataList<T>({
  query, children, empty, error, skeleton = 3, skeletonClassName, className,
}: {
  query: { isPending: boolean; isError: boolean; data?: T[] | undefined };
  /** Rendered once per row. */
  children: (row: T, index: number) => React.ReactNode;
  empty?: { title: string; description?: string };
  /** A sentence a visitor can act on. Never a stack trace. */
  error?: string;
  skeleton?: number;
  skeletonClassName?: string;
  className?: string;
}) {
  if (query.isPending) {
    return (
      <div className={className}>
        {Array.from({ length: skeleton }, (_, i) => (
          <Skeleton key={i} className={cn("h-20 rounded-xl", skeletonClassName)} />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return <p className="text-sm text-destructive">{error || "We couldn't load this. Refresh and try again."}</p>;
  }
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{empty?.title || "Nothing listed yet"}</EmptyTitle>
          {empty?.description && <EmptyDescription>{empty.description}</EmptyDescription>}
        </EmptyHeader>
      </Empty>
    );
  }
  return <div className={className}>{rows.map((r, i) => children(r, i))}</div>;
}

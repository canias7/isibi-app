import { cn } from "@/lib/utils";
/**
 * A grid that reflows on its own.
 *
 * `auto-fill` against a minimum width rather than a column count, so it needs no
 * breakpoints and cannot produce a one-item row on an odd count.
 */
export function AutoGrid({ min = 240, gap = 4, className, children }: {
  min?: number; gap?: 2 | 3 | 4 | 6 | 8; className?: string; children?: React.ReactNode;
}) {
  const g: Record<number,string> = {2:"gap-2",3:"gap-3",4:"gap-4",6:"gap-6",8:"gap-8"};
  return <div data-slot="auto-grid" className={cn("grid", g[gap], className)}
    style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }}>{children}</div>;
}

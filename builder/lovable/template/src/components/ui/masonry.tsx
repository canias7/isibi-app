import { cn } from "@/lib/utils";
/**
 * Uneven heights, packed.
 *
 * CSS columns rather than a JS layout pass: no measuring, no resize listener, and
 * it degrades to one column with no code. The trade is reading order — content
 * flows down each column, so this is for pictures, not for prose.
 */
export function Masonry({ columns = 3, gap = 4, className, children }: {
  columns?: 2 | 3 | 4; gap?: 2 | 3 | 4 | 6; className?: string; children?: React.ReactNode;
}) {
  const c = { 2:"sm:columns-2", 3:"sm:columns-2 lg:columns-3", 4:"sm:columns-2 lg:columns-4" }[columns];
  const g: Record<number,string> = {2:"gap-2",3:"gap-3",4:"gap-4",6:"gap-6"};
  return <div data-slot="masonry" className={cn("columns-1 [&>*]:mb-4 [&>*]:break-inside-avoid", c, g[gap], className)}>{children}</div>;
}

import { cn } from "@/lib/utils";
/** Makes one cell span more than one column or row inside a grid. */
export function GridItem({ colSpan = 1, rowSpan = 1, className, children }: {
  colSpan?: 1 | 2 | 3 | 4; rowSpan?: 1 | 2 | 3; className?: string; children?: React.ReactNode;
}) {
  const c: Record<number, string> = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-4" };
  const r: Record<number, string> = { 1: "", 2: "row-span-2", 3: "row-span-3" };
  return <div data-slot="grid-item" className={cn(c[colSpan], r[rowSpan], className)}>{children}</div>;
}

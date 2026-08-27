import { cn } from "@/lib/utils";
/** The horizontal one. Wraps by default, because a row that overflows is a bug. */
export function Inline({ gap = 2, align = "center", justify, wrap = true, className, children }: {
  gap?: 1 | 2 | 3 | 4 | 6 | 8; align?: "start" | "center" | "end" | "baseline";
  justify?: "start" | "center" | "end" | "between"; wrap?: boolean;
  className?: string; children?: React.ReactNode;
}) {
  const g: Record<number,string> = {1:"gap-1",2:"gap-2",3:"gap-3",4:"gap-4",6:"gap-6",8:"gap-8"};
  const a = {start:"items-start",center:"items-center",end:"items-end",baseline:"items-baseline"}[align];
  const j = justify ? {start:"justify-start",center:"justify-center",end:"justify-end",between:"justify-between"}[justify] : "";
  return <div data-slot="inline" className={cn("flex", wrap && "flex-wrap", g[gap], a, j, className)}>{children}</div>;
}

import { cn } from "@/lib/utils";
/** A vertical flex with a gap. Layout does the spacing, not per-element margins. */
export function Stack({ gap = 4, align, className, children }: {
  gap?: 1 | 2 | 3 | 4 | 6 | 8 | 10; align?: "start" | "center" | "end" | "stretch";
  className?: string; children?: React.ReactNode;
}) {
  const g: Record<number, string> = { 1:"gap-1",2:"gap-2",3:"gap-3",4:"gap-4",6:"gap-6",8:"gap-8",10:"gap-10" };
  const a = align ? { start:"items-start",center:"items-center",end:"items-end",stretch:"items-stretch" }[align] : "";
  return <div data-slot="stack" className={cn("flex flex-col", g[gap], a, className)}>{children}</div>;
}

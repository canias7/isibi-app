import { cn } from "@/lib/utils";
/** Cut to a number of lines. For a description of unknown length inside a card. */
export function ClampText({ lines = 2, className, children }: {
  lines?: 1 | 2 | 3 | 4 | 5 | 6; className?: string; children?: React.ReactNode;
}) {
  const c: Record<number,string> = {1:"line-clamp-1",2:"line-clamp-2",3:"line-clamp-3",4:"line-clamp-4",5:"line-clamp-5",6:"line-clamp-6"};
  return <p className={cn(c[lines], className)}>{children}</p>;
}

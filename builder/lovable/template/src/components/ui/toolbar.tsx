import { cn } from "@/lib/utils";
/** A row of controls above a list or a table. Left side, right side. */
export function Toolbar({ start, end, className }: {
  start?: React.ReactNode; end?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 py-3", className)}>
      <div className="flex flex-wrap items-center gap-2">{start}</div>
      <div className="flex flex-wrap items-center gap-2">{end}</div>
    </div>
  );
}

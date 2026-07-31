import { cn } from "@/lib/utils";
/** One pair, for dropping inline. Numbers get tabular figures so columns align. */
export function KeyValue({ label, value, numeric, className }: {
  label: string; value: React.ReactNode; numeric?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium", numeric && "tabular-nums")}>{value}</span>
    </div>
  );
}

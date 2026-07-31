import { cn } from "@/lib/utils";
/** The top of one record: what it is, its state, and what you can do to it. */
export function RecordHeader({ title, subtitle, status, actions, className }: {
  title: string; subtitle?: string; status?: React.ReactNode;
  actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 border-b pb-4", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {status}
        </div>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

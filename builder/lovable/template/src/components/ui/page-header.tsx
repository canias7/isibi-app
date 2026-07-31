import { cn } from "@/lib/utils";
/** Title, a line of context, and the actions for this page. */
export function PageHeader({ title, description, actions, breadcrumb, className }: {
  title: string; description?: string;
  actions?: React.ReactNode; breadcrumb?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b pb-6", className)}>
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground text-balance">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

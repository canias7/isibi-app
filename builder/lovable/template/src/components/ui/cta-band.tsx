import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The closing ask, at the bottom of a page. */
export function CtaBand({
  title, description, action, className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card px-6 py-12 text-center", className)}>
      <h2 className="text-2xl font-semibold tracking-tight text-balance">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-xl text-muted-foreground text-balance">{description}</p>}
      {action && (
        <div className="mt-6">
          <Button size="lg" asChild={!!action.href} onClick={action.onClick}>
            {action.href ? <a href={action.href}>{action.label}</a> : <span>{action.label}</span>}
          </Button>
        </div>
      )}
    </section>
  );
}

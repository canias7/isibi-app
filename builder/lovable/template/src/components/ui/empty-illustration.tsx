import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A fuller empty state, with something to do about it.
 *
 * An empty state that only says "no results" is a dead end; the action is the
 * point. The mark is drawn in CSS rather than shipped as an image.
 */
export function EmptyIllustration({ title, description, action, icon, className }: {
  title: string; description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  icon?: React.ReactNode; className?: string;
}) {
  return (
    <div data-slot="empty-illustration" className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        {icon ?? <span className="text-lg" aria-hidden="true">·</span>}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-balance">{description}</p>}
      </div>
      {action && (
        <Button size="sm" asChild={!!action.href} onClick={action.onClick}>
          {action.href ? <a href={action.href}>{action.label}</a> : <span>{action.label}</span>}
        </Button>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
/**
 * The moment the thing first did something useful, marked.
 *
 * "YOUR FIRST BOOKING CAME IN" is the sentence that decides whether somebody
 * keeps using a product, and almost nothing says it — the first real event
 * arrives in a list looking exactly like the hundredth.
 *
 * IT NAMES WHAT HAPPENS NEXT, because the moment after a first success is the
 * one moment somebody will do a bit more setup. A congratulation with no next
 * step wastes it.
 *
 * ONCE ONLY, and dismissible — the caller decides when it has been seen. A
 * milestone that keeps reappearing stops being one.
 */
export function FirstValueNote({ what, next, onDismiss, className }: {
  /** What just happened — "Your first booking came in". */
  what: string;
  next?: { label: string; href?: string; onClick?: () => void };
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border p-3 text-sm", className)}>
      <span className="font-medium">{what}</span>
      {next && (
        next.href
          ? <a href={next.href} className="underline underline-offset-4">{next.label}</a>
          : <button type="button" onClick={next.onClick} className="cursor-pointer underline underline-offset-4">{next.label}</button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss}
          className="ml-auto cursor-pointer text-xs text-muted-foreground underline underline-offset-2">Dismiss</button>
      )}
    </div>
  );
}

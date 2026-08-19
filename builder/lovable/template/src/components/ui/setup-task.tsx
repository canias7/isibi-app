import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One thing to do before the thing is usable.
 *
 * DONE IS A TICK AND A STRIKETHROUGH, never a colour — the row must read as
 * finished in greyscale and to a screen reader, which gets "Done: " from sr-only
 * text.
 *
 * OPTIONAL TASKS SAY SO. A checklist where four of six items are optional and
 * none says which makes people do all six or abandon at item three, and both are
 * worse than telling them.
 *
 * `why` carries the payoff — "so customers can pay you" — because a setup list
 * is a series of chores and the reason is what gets each one done.
 */
export function SetupTask({ title, why, done, optional, action, className }: {
  title: string; why?: string; done?: boolean; optional?: boolean;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 py-3", className)}>
      <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
        done ? "border-foreground bg-foreground text-background" : "border-border")}>
        {done && <Check className="size-3" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>
          {done && <span className="sr-only">Done: </span>}
          {title}
          {optional && <span className="ms-2 font-normal text-muted-foreground">Optional</span>}
        </p>
        {why && !done && <p className="text-xs text-muted-foreground">{why}</p>}
      </div>
      {action && !done && (
        action.href
          ? <a href={action.href} className="shrink-0 text-sm underline underline-offset-4">{action.label}</a>
          : <button type="button" onClick={action.onClick} className="shrink-0 cursor-pointer text-sm underline underline-offset-4">{action.label}</button>
      )}
    </div>
  );
}

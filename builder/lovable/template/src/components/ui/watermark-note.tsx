import { cn } from "@/lib/utils";
/**
 * Why this copy is marked, and how to get one that is not.
 *
 * A WATERMARK WITH NO EXPLANATION READS AS A FAULT. People assume the export
 * broke, or that they are on a trial they did not sign up for, and they raise a
 * ticket rather than reading a settings page.
 *
 * IT SAYS HOW TO REMOVE IT when there is a way — upgrading, buying a licence,
 * finishing verification. A mark with no stated route off is a nag; one with a
 * route is a prompt.
 *
 * Deliberately a note beside the document rather than text drawn into it: this
 * is the explanation, not the watermark. Whatever marks the file itself is the
 * caller's business.
 */
export function WatermarkNote({ why, removeBy, action, className }: {
  /** "this is a preview copy" */
  why: string;
  /** "upgrading to a paid plan" */
  removeBy?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground", className)}>
      <span><span className="font-medium text-foreground">Marked copy</span> — {why}.</span>
      {removeBy && <span>Removed by {removeBy}.</span>}
      {action && (
        action.href
          ? <a href={action.href} className="underline underline-offset-4">{action.label}</a>
          : <button type="button" onClick={action.onClick} className="cursor-pointer underline underline-offset-4">{action.label}</button>
      )}
    </p>
  );
}

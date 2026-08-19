import { cn } from "@/lib/utils";
/**
 * A few specific warnings, at the point of risk.
 *
 * SHOWN WHERE THE RISK IS, not on a help page. Advice about paying outside the
 * platform belongs beside the message where somebody is being asked to do it —
 * anywhere else it is read by people who were never going to be caught.
 *
 * SPECIFIC, NEVER GENERIC. "Stay safe online" is filler that trains people to
 * skip the box. "Nobody from us will ever ask for your password" is a rule
 * somebody can apply, and it is the caller who knows which risk applies here.
 *
 * Capped, because a list of ten warnings is a wall nobody reads — and the
 * warnings that matter most are the first two.
 */
export function SafetyTips({ tips, title = "Before you do that", max = 3, className }: {
  tips: React.ReactNode[];
  title?: string;
  max?: number;
  className?: string;
}) {
  const shown = tips.slice(0, max);
  if (!shown.length) return null;
  return (
    <section aria-label={title} className={cn("rounded-md border border-border p-3", className)}>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-1 flex list-disc flex-col gap-0.5 ps-5 text-sm text-muted-foreground">
        {shown.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </section>
  );
}

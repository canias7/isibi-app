import { cn } from "@/lib/utils";
/**
 * What somebody can do — the services a stylist offers, a trade's
 * certifications.
 *
 * Overflow collapses into "+4 more" rather than wrapping to three lines: in a
 * list of staff, one person with eleven skills otherwise makes every row
 * around them unreadable. The hidden ones stay in the accessible name, so
 * nothing is actually lost.
 */
export function SkillTags({ skills, max = 5, className }: {
  skills: string[]; max?: number; className?: string;
}) {
  if (!skills.length) return null;
  const shown = skills.slice(0, max), rest = skills.length - shown.length;
  return (
    <ul className={cn("flex flex-wrap gap-1", className)} aria-label={skills.join(", ")}>
      {shown.map((s) => (
        <li key={s} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{s}</li>
      ))}
      {rest > 0 && (
        <li className="px-1 py-0.5 text-[11px] text-muted-foreground" title={skills.slice(max).join(", ")}>
          +{rest} more
        </li>
      )}
    </ul>
  );
}

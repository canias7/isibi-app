import { cn } from "@/lib/utils";
/**
 * A permit to work — valid for a window, for named people, on one job.
 *
 * PERMITS EXPIRE DURING THE SHIFT and that is the point. A hot works permit
 * runs until 4pm; work continuing at 5pm is uninsured and, on many sites, gross
 * misconduct. Showing the window rather than a valid/invalid flag is what makes
 * that visible before it lapses.
 *
 * THE NAMED PEOPLE ARE PART OF THE PERMIT. It authorises specific individuals,
 * not a company, and somebody covering for a colleague is not covered — which
 * is exactly what happens when the permit is treated as a job-level document.
 *
 * THE ISSUER IS RECORDED. A permit nobody signed is not a permit, and in an
 * investigation the first question is who authorised the work.
 *
 * WORDS AND WEIGHT rather than a colour — permits are printed, laminated and
 * photographed, and none of those preserve a green tick.
 */
export function PermitRow({ kind, reference, from, to, expired, people = [], issuedBy, conditions = [], className }: {
  /** "Hot works", "Confined space", "Excavation". */
  kind: string;
  reference?: string;
  /** Free text — "07:30". */
  from?: string;
  to?: string;
  expired?: boolean;
  /** Who is authorised. */
  people?: string[];
  issuedBy?: string;
  /** What must be in place. */
  conditions?: string[];
  className?: string;
}) {
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("font-medium", expired && "line-through decoration-from-font")}>{kind}</span>
        {reference && <code className="font-mono text-xs text-muted-foreground">{reference}</code>}
        <span className={cn("ms-auto text-xs", expired ? "font-medium" : "text-muted-foreground")}>
          {expired ? "Expired — stop work" : from && to ? `${from} to ${to}` : "No window set"}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {people.length ? `Covers ${people.join(", ")} only` : "Nobody named — this covers no one"}
        {issuedBy && ` · issued by ${issuedBy}`}
      </p>
      {conditions.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {conditions.map((c) => (
            <li key={c} className="flex gap-2"><span aria-hidden="true">·</span><span>{c}</span></li>
          ))}
        </ul>
      )}
    </li>
  );
}

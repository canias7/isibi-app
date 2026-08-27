import { cn } from "@/lib/utils";
/**
 * What is stopping this from moving.
 *
 * IT NAMES THE THING AND LINKS TO IT. "Blocked" is a status; "Blocked by the
 * survey, which is waiting on Ana" is the start of a conversation — and the link
 * is what stops somebody having to search for a ticket number.
 *
 * SEVERAL BLOCKERS ARE LISTED, not counted. Clearing one of three and finding it
 * still blocked is the frustration this prevents, and the second blocker is
 * often the real one.
 *
 * `role="status"` rather than alert: a blocker is a standing condition somebody
 * arrives at, not an interruption.
 */
export function BlockedBy({ blockers, className }: {
  blockers: { key: string; label: string; href?: string; owner?: string }[];
  className?: string;
}) {
  if (!blockers.length) return null;
  return (
    <div data-slot="blocked-by" role="status" className={cn("text-sm", className)}>
      <p className="font-medium">
        Blocked by {blockers.length === 1 ? "one thing" : `${blockers.length} things`}
      </p>
      <ul className="mt-0.5 flex flex-col gap-0.5 text-muted-foreground">
        {blockers.map((b) => (
          <li key={b.key}>
            {b.href
              ? <a href={b.href} className="underline underline-offset-4">{b.label}</a>
              : b.label}
            {b.owner && <span> — with {b.owner}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

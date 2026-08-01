import { cn } from "@/lib/utils";
/**
 * Some of it is down and some of it is fine.
 *
 * BOTH LISTS, AND AFFECTED FIRST. "We are experiencing issues" makes every
 * reader assume the part they need is broken; naming what still works keeps the
 * people it does not affect from queueing at support.
 *
 * STATUS IS A WORD PER ROW, never a coloured dot. A column of green and red
 * circles is the classic status-page failure — meaningless in greyscale,
 * meaningless to a screen reader, and the commonest colour blindness makes the
 * two indistinguishable.
 *
 * Renders nothing when nothing is affected, so it can live permanently in a
 * layout without a "everything is fine" row nobody reads.
 */
export function PartialOutage({ affected, working, since, className }: {
  affected: { name: string; state?: string }[];
  working?: string[];
  since?: string;
  className?: string;
}) {
  if (!affected.length) return null;
  return (
    <section role="status" aria-label="Service status"
      className={cn("flex flex-col gap-2 rounded-md border border-border p-4", className)}>
      <p className="text-sm font-medium">
        Some things aren&apos;t working{since ? <span className="font-normal text-muted-foreground"> · since {since}</span> : null}
      </p>
      <ul className="flex flex-col gap-0.5 text-sm">
        {affected.map((a) => (
          <li key={a.name} className="flex justify-between gap-3">
            <span>{a.name}</span>
            <span className="shrink-0 text-muted-foreground">{a.state ?? "Down"}</span>
          </li>
        ))}
      </ul>
      {working?.length ? (
        <p className="text-sm text-muted-foreground">Still working: {working.join(", ")}</p>
      ) : null}
    </section>
  );
}

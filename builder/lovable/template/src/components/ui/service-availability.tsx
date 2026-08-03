import { cn } from "@/lib/utils";

/**
 * What this ADDRESS can actually get — the answer a broadband, energy or
 * waste-collection site exists to give, and the one almost none of them lead
 * with.
 *
 * THE ADDRESS IS PRINTED, and it is a required prop for that reason. Every
 * service-checker result is meaningless without the address it is about, and
 * the failure is silent: somebody checks their old house, sees "900 Mb
 * available", and orders. A result panel that cannot say what it is a result
 * FOR is a result nobody can act on.
 *
 * STATUS IS FILL PLUS A WRITTEN WORD, never colour. Three states — here now,
 * coming, not here — are exactly where a green/amber/red row fails, because
 * the distinction that matters most (can I have it or not) is the one hue
 * carries worst in greyscale, in print and to anyone who cannot see it. So:
 * available is the solid bar, planned is the half bar, unavailable is the
 * empty track AND the headline is struck through.
 *
 * AN UNAVAILABLE ROW IS SHOWN, not filtered out. Removing it answers "what can
 * I get" and leaves "why can't I get the thing my neighbour has" unanswered —
 * which is the question that generates the phone call.
 */
export type ServiceOption = {
  name: string;
  /** The headline figure or promise — "900 Mb", "Tuesday collections". */
  headline: string;
  status: "available" | "planned" | "unavailable";
  /** Why, or when. The most useful part of an unavailable row. */
  note?: string | null;
};

const WORD = {
  available: "Available here",
  planned: "Planned",
  unavailable: "Not available here",
};

export function ServiceAvailability({ address, items, className }: {
  /** The address these results are for. Required — a result with no subject is not a result. */
  address: string;
  items: ServiceOption[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={cn("rounded-xl border border-border", className)}>
      <div className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Results for</p>
        <p className="mt-0.5 font-medium">{address}</p>
      </div>
      <ul className="divide-y divide-border">
        {items.map((o) => (
          <li key={o.name} className="flex items-start gap-4 px-5 py-4">
            {/* The bar carries the state by how much of it is filled. Fixed
                width so three rows are comparable at a glance. */}
            <span aria-hidden className="mt-1.5 h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
              {o.status === "available" && <span className="block h-full w-full bg-foreground" />}
              {o.status === "planned" && <span className="block h-full w-1/2 bg-foreground" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={cn("font-medium", o.status === "unavailable" && "line-through decoration-1")}>
                  {o.name}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">{o.headline}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{WORD[o.status]}</span>
                {o.note ? <> — {o.note}</> : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

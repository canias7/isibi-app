import { cn } from "@/lib/utils";
/**
 * How to reach a person, with the hours so nobody waits for nothing.
 *
 * OPENING HOURS ARE PART OF THE CONTACT DETAILS, not a separate page. Somebody
 * messaging support at 21:00 needs to know they will hear back tomorrow — being
 * told after they have sat waiting is the thing that turns a small problem into
 * a complaint.
 *
 * EACH ROUTE CARRIES ITS EXPECTED WAIT, because they differ enormously and
 * people choose wrongly without it: chat now versus email in two days is a real
 * decision and an unlabelled list of icons hides it.
 *
 * Channels are links or buttons, never plain text — a phone number that cannot
 * be tapped on a phone is the smallest and most avoidable friction there is.
 */
export type SupportRoute = { label: string; href?: string; onClick?: () => void; wait?: string };

export function SupportHandoff({ routes, hours, closedNote, className }: {
  routes: SupportRoute[];
  /** "Mon–Fri, 9am–5pm" */
  hours?: string;
  /** Shown when currently closed. */
  closedNote?: string;
  className?: string;
}) {
  if (!routes.length) return null;
  return (
    <div className={cn("flex flex-col gap-2 rounded-md border border-border p-4", className)}>
      <p className="text-sm font-medium">Talk to someone</p>
      <ul className="flex flex-col gap-1 text-sm">
        {routes.map((r) => (
          <li key={r.label} className="flex flex-wrap items-baseline gap-x-2">
            {r.href
              ? <a href={r.href} className="underline underline-offset-4">{r.label}</a>
              : <button type="button" onClick={r.onClick} className="cursor-pointer underline underline-offset-4">{r.label}</button>}
            {r.wait && <span className="text-xs text-muted-foreground">{r.wait}</span>}
          </li>
        ))}
      </ul>
      {hours && <p className="text-xs text-muted-foreground">{hours}</p>}
      {closedNote && <p className="text-xs font-medium">{closedNote}</p>}
    </div>
  );
}

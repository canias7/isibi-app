import { cn } from "@/lib/utils";
/**
 * Who is on call this minute, and how to reach them.
 *
 * ONE NAME, NOT A ROTA. This is read by somebody with a problem at 2am, and a
 * schedule table makes them work out who that implies. The name and the number
 * are the whole answer.
 *
 * NOBODY-ON-CALL IS A STATE AND IT IS THE MOST IMPORTANT ONE. A rota with a
 * hole renders as an empty component in every implementation, which reads as a
 * loading failure — so somebody keeps refreshing instead of ringing the backup.
 * It says so, and points at whatever the caller gives as a fallback.
 *
 * "UNTIL" IS ALWAYS SHOWN, because at 2am the second question is whether to
 * ring now or wait for the handover in twenty minutes.
 *
 * THE NUMBER IS A `tel:` LINK. Retyping eleven digits under pressure is how the
 * wrong person gets rung, and this is the one component where that happens at
 * the worst moment.
 */
export function OnCallNow({ name, role, phone, until, backup, className }: {
  /** Omit when nobody is on. */
  name?: string;
  role?: string;
  phone?: string;
  /** When they hand over — "6am". */
  until?: string;
  /** What to do when nobody is on. */
  backup?: React.ReactNode;
  className?: string;
}) {
  const digits = phone?.replace(/[^\d+]/g, "");
  if (!name) {
    return (
      <div data-slot="on-call-now" role="alert" className={cn("space-y-1 rounded-md border border-foreground/40 bg-muted/40 px-3 py-2 text-sm", className)}>
        <p className="font-medium">Nobody is on call right now</p>
        {backup ?? <p className="text-xs text-muted-foreground">There is no fallback set for this period.</p>}
      </div>
    );
  }
  return (
    <div className={cn("rounded-md border border-border px-3 py-2 text-sm", className)}>
      <p>
        <span className="font-medium">{name}</span>
        {role && <span className="text-muted-foreground"> · {role}</span>}
        {until && <span className="block text-xs text-muted-foreground">On call until {until}</span>}
      </p>
      {phone && (
        <p className="mt-0.5">
          <a href={`tel:${digits}`} className="underline underline-offset-2">{phone}</a>
        </p>
      )}
    </div>
  );
}

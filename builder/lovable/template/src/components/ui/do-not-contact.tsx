import { cn } from "@/lib/utils";
/**
 * A standing instruction not to contact somebody, shown where it stops a call.
 *
 * IT SITS ON THE RECORD, NOT IN A SETTINGS PAGE. A do-not-contact flag buried in
 * preferences is one nobody sees before picking up the phone — and contacting
 * somebody who has opted out is, in a good many places, the one contact-related
 * thing that carries a fine.
 *
 * IT SEPARATES MARKETING FROM SERVICE. Almost nobody means "never speak to me
 * again"; they mean "no marketing" — and a blanket flag that also blocks "your
 * appointment has moved" is a worse outcome for everybody. Scopes are listed.
 *
 * WHO SET IT AND WHEN IS PART OF THE RECORD. An instruction with no origin gets
 * quietly overridden by whoever disagrees with it, and it is the field a
 * regulator would ask about.
 *
 * `role="alert"` for the blanket case only. A marketing opt-out is a fact for
 * whoever is composing a campaign; a full block is a fact for whoever is about
 * to dial.
 */
export function DoNotContact({ scopes, setBy, at, reason, className }: {
  /** What is blocked — "marketing", "everything". */
  scopes: string[];
  setBy?: string;
  /** ISO date. */
  at?: string;
  reason?: string;
  className?: string;
}) {
  if (!scopes.length) return null;
  const blanket = scopes.some((s) => /everything|all/i.test(s));
  const d = at ? new Date(at) : null;
  const ok = d && !Number.isNaN(d.getTime());
  return (
    <div {...(blanket ? { role: "alert" } : { role: "status" })}
      className={cn("rounded-md border px-3 py-2 text-sm",
        blanket ? "border-foreground/40 bg-muted/40" : "border-border", className)}>
      <p className="font-medium">
        Do not contact{blanket ? "" : ` about ${scopes.join(", ")}`}
      </p>
      <p className="text-xs text-muted-foreground">
        {reason && <span className="block">{reason}</span>}
        {(setBy || ok) && (
          <span className="block">
            Set{setBy ? ` by ${setBy}` : ""}
            {ok && (
              <> on <time dateTime={d!.toISOString().slice(0, 10)}>
                {d!.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </time></>
            )}
          </span>
        )}
      </p>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Asking for the reader's location — in our own words, before the browser's.
 *
 * THE BROWSER PROMPT IS ONE-SHOT AND UNRECOVERABLE, which is the whole reason
 * this exists. Fire `getCurrentPosition` on page load, get a reflexive "Block",
 * and the site can never ask again — the reader has to go into browser settings
 * they will not find. Asking first, in a panel that says WHY, means a refusal
 * costs nothing and the real prompt only appears once somebody has agreed to
 * see it.
 *
 * THE MANUAL ALTERNATIVE IS EQUALLY PROMINENT. "Enter a postcode instead" is
 * not a consolation prize — for many readers it is the preferred answer, and a
 * flow where declining leaves you stuck is one that extracts consent rather
 * than asking for it.
 *
 * IT STATES WHAT THE LOCATION IS FOR, in a sentence. "Allow location access?"
 * with no purpose is the request people refuse by default, correctly.
 *
 * DENIED IS A NAMED STATE, with honest advice — once blocked, only the browser
 * can undo it, and pretending otherwise sends people round a loop.
 */
export function LocationConsent({ state, reason, onAllow, onManual, manualLabel = "Enter a postcode instead", className }: {
  state: "ask" | "asking" | "denied" | "granted";
  /** Why the location is wanted — one sentence. */
  reason: string;
  onAllow: () => void;
  onManual?: () => void;
  manualLabel?: string;
  className?: string;
}) {
  if (state === "granted") return null;
  return (
    <div className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm">{reason}</p>
      {state === "denied" ? (
        <p className="text-xs text-muted-foreground">
          Location is blocked for this site. Only your browser settings can turn it back on.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {state !== "denied" && (
          <Button type="button" size="sm" onClick={onAllow} disabled={state === "asking"}>
            {state === "asking" ? "Waiting for your browser…" : "Use my location"}
          </Button>
        )}
        {onManual && (
          <Button type="button" size="sm" variant="outline" onClick={onManual}>{manualLabel}</Button>
        )}
      </div>
    </div>
  );
}

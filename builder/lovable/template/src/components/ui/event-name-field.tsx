import { cn } from "@/lib/utils";
/**
 * Naming an analytics event, with the convention enforced as you type.
 *
 * INCONSISTENT EVENT NAMES ARE UNFIXABLE LATER. `Booking Created`, `booking
 * created` and `bookingCreated` are three events in every analytics tool, and
 * once they are in the historical data no rename repairs it — the funnel is
 * simply wrong for the months before the fix. Enforcing the shape at the moment
 * of naming is the only cheap intervention.
 *
 * IT SUGGESTS AN EXISTING NAME RATHER THAN ONLY REFUSING. Most duplicates are
 * somebody not knowing the event already exists, and a near-match is far more
 * useful than a validation error.
 *
 * IT NORMALISES QUIETLY AND SAYS SO. Silently lowercasing feels broken and
 * rejecting an unambiguous fix is rude — the same balance `subdomain-field`
 * strikes.
 *
 * THE CONVENTION IS SHOWN AS AN EXAMPLE, not a regular expression. Nobody
 * reading a settings screen wants to parse `^[a-z]+(_[a-z]+)*$`.
 */
export function EventNameField({ value, onChange, existing = [], convention = "object_action", example = "booking_created", id = "event-name", className }: {
  value: string;
  onChange: (v: string) => void;
  /** Names already in use. */
  existing?: string[];
  convention?: string;
  example?: string;
  id?: string;
  className?: string;
}) {
  const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_/, "");
  const taken = existing.includes(value);
  const near = !taken && value.length > 3
    ? existing.find((e) => e.replace(/_/g, "").includes(value.replace(/_/g, "")) || value.replace(/_/g, "").includes(e.replace(/_/g, "")))
    : undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">Event name</label>
      <input id={id} value={value} autoCapitalize="none" autoCorrect="off" spellCheck={false}
        onChange={(e) => onChange(clean(e.target.value))} placeholder={example}
        className="h-9 w-full rounded-md border border-input bg-transparent px-2 font-mono text-sm" />
      <p className="text-xs text-muted-foreground">
        {convention} — like <code className="font-mono">{example}</code>. Lower case and underscores; anything else is
        converted as you type.
      </p>
      {taken && (
        <p role="status" className="text-xs font-medium">
          <code className="font-mono">{value}</code> already exists — use it rather than making a second one.
        </p>
      )}
      {near && (
        <p role="status" className="text-xs">
          <span className="text-muted-foreground">Did you mean </span>
          <code className="font-mono">{near}</code>
          <span className="text-muted-foreground">? Two names for one thing splits the data for good.</span>
        </p>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
/**
 * The properties an event carries, with the types it is supposed to send.
 *
 * A TYPE THAT DRIFTS BREAKS EVERY CHART SILENTLY. `amount` sent as a number for
 * a year and then as `"42.00"` stops summing, and the total simply reads lower
 * — no error anywhere. Declaring the type is what makes the drift detectable,
 * and this is where it is declared.
 *
 * PERSONAL DATA IS FLAGGED PER PROPERTY. Analytics is where email addresses end
 * up by accident, because somebody adds `user_email` to debug something and it
 * is still there two years later. Marking it makes the decision visible at the
 * moment it is made.
 *
 * REQUIRED VERSUS OPTIONAL IS STATED, since a chart grouped by a property that
 * is missing on half the events shows a large "(not set)" bucket that gets
 * misread as a real category.
 *
 * EXAMPLE VALUES, because a type alone does not say whether `status` is
 * `confirmed` or `CONFIRMED` — and that inconsistency splits a chart exactly
 * like a bad event name does.
 */
export type EventProperty = {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  /** True when it can carry personal data. */
  personal?: boolean;
  example?: string;
  note?: string;
};

export function PropertySchema({ properties, className }: {
  properties: EventProperty[];
  className?: string;
}) {
  if (!properties.length) return null;
  const personal = properties.filter((p) => p.personal);
  return (
    <div className={cn("space-y-1.5", className)}>
      {personal.length > 0 && (
        <p className="text-xs">
          <span className="font-medium">{personal.length}</span>
          <span className="text-muted-foreground">
            {" "}of these can carry personal data — make sure that is deliberate.
          </span>
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {properties.map((p) => (
          <li key={p.id} className="flex items-start gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <code className="font-mono text-xs">{p.name}</code>
              <span className="block text-xs text-muted-foreground">
                {p.example && <>e.g. <code className="font-mono">{p.example}</code></>}
                {p.example && p.note ? " · " : ""}
                {p.note}
              </span>
            </span>
            <span className="shrink-0 text-end text-xs">
              <span className="block font-mono">{p.type}</span>
              <span className="block text-muted-foreground">{p.required ? "required" : "optional"}</span>
              {p.personal && <span className="block font-medium">personal data</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

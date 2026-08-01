import { cn } from "@/lib/utils";
/**
 * What sets a rule off, chosen from what the system can actually detect.
 *
 * EVENTS AND SCHEDULES ARE SEPARATED, because they behave differently in the
 * one way that matters: an event fires per record, a schedule fires per period
 * over all of them. Somebody who picks "every morning" expecting one message
 * per booking has built the wrong rule, and grouping is the cheapest place to
 * make that difference visible.
 *
 * EACH TRIGGER SAYS WHEN IT ACTUALLY FIRES. "Booking updated" sounds obvious
 * until it turns out to include the customer changing their own phone number —
 * so the note carries the edge, which is the difference between a rule that
 * works and one that fires forty times a day.
 *
 * A REAL RADIO GROUP with a `<legend>` per group, so arrow keys move within a
 * group and a screen reader announces which group an option belongs to.
 *
 * UNAVAILABLE TRIGGERS ARE SHOWN, DISABLED, WITH THE REASON. Hiding them makes
 * somebody hunt for a trigger that does not exist here; naming what is missing
 * tells them what to turn on.
 */
export type Trigger = {
  id: string;
  label: string;
  kind?: "event" | "schedule";
  note?: string;
  disabled?: boolean;
  reason?: string;
};

export function TriggerPicker({ triggers, value, onChange, name = "trigger", className }: {
  triggers: Trigger[];
  value: string;
  onChange: (id: string) => void;
  name?: string;
  className?: string;
}) {
  const groups: { kind: "event" | "schedule"; title: string }[] = [
    { kind: "event", title: "When something happens" },
    { kind: "schedule", title: "On a schedule" },
  ];
  return (
    <div className={cn("space-y-3", className)}>
      {groups.map((g) => {
        const items = triggers.filter((t) => (t.kind ?? "event") === g.kind);
        if (!items.length) return null;
        return (
          <fieldset key={g.kind} className="space-y-1">
            <legend className="text-sm font-medium">{g.title}</legend>
            {items.map((t) => (
              <label key={t.id}
                className={cn("flex items-start gap-2.5 text-sm", t.disabled ? "opacity-60" : "cursor-pointer")}>
                <input type="radio" name={name} value={t.id} checked={value === t.id} disabled={t.disabled}
                  onChange={() => onChange(t.id)} className="mt-0.5 size-4 accent-foreground" />
                <span className="min-w-0">
                  {t.label}
                  {(t.note || t.reason) && (
                    <span className="block text-xs text-muted-foreground">
                      {t.disabled ? (t.reason ?? "Not available") : t.note}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

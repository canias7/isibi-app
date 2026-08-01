import { cn } from "@/lib/utils";
/**
 * Choosing a priority, with each level saying what it commits somebody to.
 *
 * EACH LEVEL STATES ITS RESPONSE TIME. Without that, "High" means whatever the
 * person choosing wants it to mean, everything becomes High within a month, and
 * the field stops carrying information. Attaching a promise to each level is
 * what makes people pick the honest one.
 *
 * THE TOP LEVEL CAN BE RESTRICTED. "Critical, wakes somebody up" is not a
 * choice everybody should have, and hiding it is worse than showing it disabled
 * with the reason — hidden, people pick High and add "URGENT" to the title.
 *
 * ORDER IS LOWEST FIRST, so the list reads as escalating and the eye lands on
 * the ordinary choice. Reversing it makes the most severe option the
 * default-looking one, which is exactly how priority inflation starts.
 *
 * A REAL RADIO GROUP — arrow keys, "2 of 4", and the response time announced
 * with the level rather than sitting beside it as unattached text.
 */
export type Priority = {
  id: string;
  label: string;
  /** What choosing it promises — "someone looks within an hour". */
  commitment?: string;
  disabled?: boolean;
  reason?: string;
};

export function PriorityPicker({ levels, value, onChange, name = "priority", legend = "Priority", className }: {
  /** Lowest first. */
  levels: Priority[];
  value: string;
  onChange: (id: string) => void;
  name?: string;
  legend?: string;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-1.5", className)}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {levels.map((l) => (
        <label key={l.id}
          className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm",
            value === l.id ? "border-foreground bg-muted/40" : "border-border",
            l.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
          <input type="radio" name={name} value={l.id} checked={value === l.id} disabled={l.disabled}
            onChange={() => onChange(l.id)} className="mt-0.5 size-4 accent-foreground" />
          <span className="min-w-0">
            <span className="block">{l.label}</span>
            {(l.commitment || l.reason) && (
              <span className="block text-xs text-muted-foreground">
                {l.disabled ? (l.reason ?? "Not available to you") : l.commitment}
              </span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

import { cn } from "@/lib/utils";
/**
 * A privacy setting with named levels rather than a switch.
 *
 * A SWITCH CANNOT EXPRESS THE MIDDLE, and the middle is where most people
 * actually want to be. "Who can see your bookings" has at least three honest
 * answers — nobody, my barber, anyone with the link — and a boolean forces two
 * of them together, always in the more exposed direction.
 *
 * EVERY LEVEL SAYS WHO CAN SEE IT, in the same grammatical shape. Levels named
 * "Private / Limited / Public" without that sentence make somebody guess what
 * limited means, and they guess more restrictive than it is.
 *
 * THE ORDER IS NARROWEST FIRST, so the list reads as opening up and the safest
 * option is where the eye lands first. Reversing it makes the most exposing
 * choice the default-looking one.
 *
 * A REAL RADIO GROUP with a `<legend>` — arrow keys move, and a screen reader
 * says "2 of 3", which is the only way to know a middle option exists at all
 * without seeing the list.
 */
export type PrivacyLevel = { id: string; label: string; who: string };

export function PrivacyChoice({ title, levels, value, onChange, name, note, className }: {
  title: string;
  /** Narrowest first. */
  levels: PrivacyLevel[];
  value: string;
  onChange: (id: string) => void;
  name?: string;
  note?: string;
  className?: string;
}) {
  const group = name ?? `pc-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <fieldset data-slot="privacy-choice" className={cn("space-y-1.5", className)}>
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      {levels.map((l) => (
        <label key={l.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="radio" name={group} value={l.id} checked={value === l.id}
            onChange={() => onChange(l.id)} className="mt-0.5 size-4 accent-foreground" />
          <span className="min-w-0">
            <span className="block">{l.label}</span>
            <span className="block text-xs text-muted-foreground">{l.who}</span>
          </span>
        </label>
      ))}
      {note && <p className="pt-1 text-xs text-muted-foreground">{note}</p>}
    </fieldset>
  );
}

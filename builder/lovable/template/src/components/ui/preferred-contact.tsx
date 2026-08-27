import { cn } from "@/lib/utils";
/**
 * How this person asked to be contacted — read-only, on the owner's screen.
 *
 * THE DIFFERENCE FROM `contact-method-picker` IS WHO IS LOOKING. That is the
 * customer choosing; this is the member of staff about to ring somebody who
 * asked never to be rung. The preference is worthless if it is only visible on
 * the form where it was set.
 *
 * "DO NOT" IS STATED AS AN INSTRUCTION, not as an absent tick. A channel simply
 * missing from a list reads as "not specified", which staff correctly treat as
 * permission — so a refusal has to be a sentence.
 *
 * THE TIME WINDOW IS PART OF THE PREFERENCE. "Phone, but not before 10" is what
 * people actually say, and a component with only a channel throws away the half
 * that stops a 7am call.
 *
 * IT IS A `<dl>`, so a screen reader pairs the channel with its detail rather
 * than reading a run of loose strings.
 */
export function PreferredContact({ prefers, avoid = [], window: hours, note, className }: {
  /** Channels in order of preference. */
  prefers: string[];
  /** Channels they asked us not to use. */
  avoid?: string[];
  /** "not before 10am". */
  window?: string;
  note?: string;
  className?: string;
}) {
  if (!prefers.length && !avoid.length && !hours && !note) return null;
  return (
    <dl data-slot="preferred-contact" className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm", className)}>
      {prefers.length > 0 && (
        <div className="contents">
          <dt className="text-muted-foreground">Prefers</dt>
          <dd>{prefers.join(", then ")}</dd>
        </div>
      )}
      {avoid.length > 0 && (
        <div className="contents">
          <dt className="text-muted-foreground">Do not use</dt>
          <dd className="font-medium">{avoid.join(", ")}</dd>
        </div>
      )}
      {hours && (
        <div className="contents">
          <dt className="text-muted-foreground">When</dt>
          <dd>{hours}</dd>
        </div>
      )}
      {note && (
        <div className="contents">
          <dt className="text-muted-foreground">Note</dt>
          <dd>{note}</dd>
        </div>
      )}
    </dl>
  );
}

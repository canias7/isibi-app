import { cn } from "@/lib/utils";
/**
 * "3 of 5 chosen" — and what happens when you reach 5.
 *
 * A cap that is only discovered by hitting it is the reason people build a
 * careful selection and then find the last click does nothing. Stating the
 * ceiling up front costs one line and removes the whole failure.
 *
 * AT THE LIMIT IT SAYS SO IN WORDS and says what to do — "Remove one to choose
 * another" — because the failure people report is not "I hit a limit", it is
 * "the tick boxes stopped working". Naming the fix turns a bug report into an
 * action.
 *
 * `role="status"` with the count, so the number is announced as it changes; and
 * `aria-live` announces the at-limit sentence the moment it appears, which is
 * the one time this component has something urgent to say.
 *
 * Renders nothing when there is no cap. A limit component on an uncapped list
 * would be inventing a rule.
 */
export function SelectionLimit({ selected, max, atLimitNote = "Remove one to choose another.", className }: {
  selected: number;
  /** The cap. Omit when there is not one. */
  max?: number;
  atLimitNote?: string;
  className?: string;
}) {
  if (typeof max !== "number" || max <= 0) return null;
  const full = selected >= max;
  return (
    <p data-slot="selection-limit" role="status" className={cn("text-sm tabular-nums", full ? "font-medium" : "text-muted-foreground", className)}>
      {selected} of {max} chosen
      {full ? ` · ${atLimitNote}` : ""}
    </p>
  );
}

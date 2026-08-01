import { cn } from "@/lib/utils";
/**
 * Swap what is ticked for what is not.
 *
 * The shortcut for "everything except these four", which people otherwise do by
 * selecting all and then unticking four things — or, on a long list, by giving
 * up.
 *
 * IT STATES THE RESULTING NUMBER BEFORE THE PRESS: "Select the other 1,243".
 * Inversion is the one selection action whose outcome nobody can picture, and a
 * button labelled only "Invert" is a coin toss followed by a scroll to find out
 * what happened.
 *
 * Renders nothing with an empty selection, where inverting means "select
 * everything" and `select all` is the control that already says that, and
 * nothing when everything is already picked, where it means "clear".
 * Offering it in either state is offering a second name for a button that is
 * already on the page.
 */
export function InvertSelection({ selected, total, onInvert, className }: {
  selected: number;
  total: number;
  onInvert: () => void;
  className?: string;
}) {
  if (selected <= 0 || selected >= total) return null;
  const other = total - selected;
  return (
    <button type="button" onClick={onInvert}
      className={cn("cursor-pointer text-sm underline underline-offset-4 tabular-nums", className)}>
      Select the other {other.toLocaleString()}
    </button>
  );
}

import { cn } from "@/lib/utils";
/**
 * Which values a new thing starts with, and which have been changed from them.
 *
 * "CHANGED FROM DEFAULT" IS THE ONLY INTERESTING FACT on a settings screen with
 * forty rows. Somebody debugging asks "what is not standard here?", and without
 * this they read every row and compare from memory. Each changed row states
 * what the default was, so reverting is an informed decision rather than a
 * guess.
 *
 * REVERT IS PER-ROW AND ALSO ALL-AT-ONCE, because both are real needs: undoing
 * one experiment, and putting a mangled configuration back to something known.
 * The all-at-once one confirms; the per-row one does not, since a single value
 * is trivially re-entered.
 *
 * CHANGED IS MARKED BY A WORD AND WEIGHT. This is the kind of table that gets
 * pasted into a ticket as a screenshot, where colour is the first thing lost.
 *
 * Values are rendered as text via `String`, so a boolean shows as "true"
 * rather than vanishing the way `{false}` does in JSX.
 */
export type DefaultRow = { key: string; label: string; value: unknown; defaultValue: unknown };

export function DefaultSet({ rows, onRevert, onRevertAll, className }: {
  rows: DefaultRow[];
  onRevert?: (key: string) => void;
  onRevertAll?: () => void;
  className?: string;
}) {
  const changed = rows.filter((r) => String(r.value) !== String(r.defaultValue));
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline gap-3">
        <p className="text-sm">
          {changed.length === 0
            ? "Everything is at its default"
            : <><span className="font-medium">{changed.length}</span> changed from default</>}
        </p>
        {changed.length > 0 && onRevertAll && (
          <button type="button"
            onClick={() => { if (window.confirm("Put every setting back to its default?")) onRevertAll(); }}
            className="ml-auto text-xs underline underline-offset-2">
            Revert all
          </button>
        )}
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((r) => {
          const isChanged = String(r.value) !== String(r.defaultValue);
          return (
            <li key={r.key} className="flex items-baseline gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                {r.label}
                {isChanged && (
                  <span className="block text-xs text-muted-foreground">
                    Default: {String(r.defaultValue)}
                  </span>
                )}
              </span>
              <span className={cn("shrink-0 text-right", isChanged && "font-medium")}>
                {String(r.value)}
                {isChanged && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Changed</span>}
              </span>
              {isChanged && onRevert && (
                <button type="button" onClick={() => onRevert(r.key)}
                  className="shrink-0 text-xs underline underline-offset-2">
                  Revert
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

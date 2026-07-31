import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Change one field across many selected rows at once.
 *
 * Every field is OPT-IN by a checkbox, and untouched fields are not sent. This
 * is the difference between "set the price to £28 on these nine" and "set the
 * price to £28 and blank the notes on these nine" — a panel that submits its
 * whole form applies every empty field as a deletion, which is the most
 * destructive thing a bulk editor can do and the mistake is invisible until
 * somebody looks at a row.
 *
 * The COUNT is in the button, not only in a heading: "Update 9 bookings" is the
 * last thing read before committing, and acting on "all" when you meant the
 * visible page is the expensive mistake this pattern causes. Same rule as
 * `bulk-actions`.
 *
 * Nothing is enabled until at least one field is ticked, so a stray Enter
 * cannot submit a no-op that still writes to every row.
 */
export function BulkEditPanel({
  count, noun = "row", fields, onApply, onCancel, busy, className,
}: {
  count: number;
  noun?: string;
  fields: { key: string; label: React.ReactNode; render: (enabled: boolean) => React.ReactNode }[];
  onApply: (enabledKeys: string[]) => void;
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [on, setOn] = React.useState<string[]>([]);
  const plural = count === 1 ? noun : `${noun}s`;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (on.length && !busy) onApply(on); }}
      className={cn("flex flex-col gap-3 rounded-lg border border-border p-4", className)}
    >
      <p className="text-sm">
        Editing <strong className="tabular-nums">{count.toLocaleString()}</strong> {plural}.
        Only the fields you tick will change.
      </p>
      <div className="flex flex-col gap-3">
        {fields.map((f) => {
          const enabled = on.includes(f.key);
          return (
            <div key={f.key} className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id={`bulk-${f.key}`}
                checked={enabled}
                onChange={() => setOn((xs) => (enabled ? xs.filter((x) => x !== f.key) : [...xs, f.key]))}
                className="mt-2.5 size-4 shrink-0 cursor-pointer accent-foreground"
              />
              <div className="min-w-0 flex-1">
                <label htmlFor={`bulk-${f.key}`} className={cn("block cursor-pointer text-xs font-medium",
                  !enabled && "text-muted-foreground")}>
                  {f.label}
                </label>
                <div className={cn("mt-1", !enabled && "pointer-events-none opacity-40")}>{f.render(enabled)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={on.length === 0 || busy}
          className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
          {busy ? "Updating…" : `Update ${count.toLocaleString()} ${plural}`}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={busy}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Cancel
          </button>
        ) : null}
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {on.length === 0 ? "No fields ticked" : `${on.length} ${on.length === 1 ? "field" : "fields"}`}
        </span>
      </div>
    </form>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Switching a display between rounded and exact.
 *
 * ROUNDED IS THE DEFAULT AND EXACT IS ONE PRESS AWAY. Dashboards need
 * legibility; audits need every digit. Making exact the default fills every
 * card with noise, and hiding it entirely makes the tool useless the day the
 * accountant asks — the toggle is the honest middle.
 *
 * IT IS ONE SETTING FOR THE WHOLE VIEW, via context, not per number. A page
 * with some numbers rounded and some exact invites false comparisons between
 * them, which is worse than either mode.
 *
 * THE ROUNDING RULE IS STATED ON THE CONTROL — "nearest hundred" — so what
 * "rounded" means is not a guess. And rounded SUMS are recomputed from exact
 * values, never summed from rounded ones; the drift between those two is a
 * classic way a report fails an audit.
 *
 * `aria-pressed` on the toggle; the numbers re-render, so no live region is
 * needed.
 */
const Ctx = React.createContext<{ exact: boolean; nearest: number }>({ exact: false, nearest: 100 });

export function PrecisionProvider({ exact, nearest = 100, children }: {
  exact: boolean;
  nearest?: number;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ exact, nearest }), [exact, nearest]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function PrecisionToggle({ exact, onChange, nearest = 100, className }: {
  exact: boolean;
  onChange: (exact: boolean) => void;
  nearest?: number;
  className?: string;
}) {
  return (
    <button data-slot="precision-toggle" type="button" onClick={() => onChange(!exact)} aria-pressed={exact}
      className={cn("cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-muted", className)}>
      {exact ? "Showing exact figures" : `Rounded to the nearest ${nearest.toLocaleString()}`}
    </button>
  );
}

export function PrecisionNumber({ value, format, className }: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const { exact, nearest } = React.useContext(Ctx);
  const shown = exact ? value : Math.round(value / nearest) * nearest;
  const text = format ? format(shown) : shown.toLocaleString();
  return (
    <span data-slot="precision-number" className={cn("tabular-nums", className)} title={exact ? undefined : (format ? format(value) : value.toLocaleString())}>
      {exact ? text : `~${text}`}
    </span>
  );
}

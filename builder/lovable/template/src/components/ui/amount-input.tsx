import * as React from "react";
import { CurrencyInput } from "@/components/ui/currency-input";
/**
 * Money in and out as INTEGER MINOR UNITS — pennies, not floats.
 *
 * THE VALUE IS `minor: number` (450 = £4.50), because 0.1 + 0.2 is the
 * whole argument: float money loses pennies in sums, and the penny it
 * loses is always somebody's. The conversion to and from the typed
 * string happens HERE, once, instead of at every call site with every
 * call site's own rounding bug.
 *
 * BLUR NORMALISES THE DISPLAY ("4.5" → "4.50") without touching the
 * value — mid-typing text is the person's (the coordinate-input rule);
 * the settled field shows the canonical form.
 *
 * Entry UX is currency-input's (decimal keypad, symbol as an addon);
 * this wraps it with the contract. `null` means empty — zero is a
 * price, absence is not (the currency-amount distinction, upstream).
 */
export function AmountInput({ minor, onChange, symbol = "£", id, className }: {
  minor: number | null;
  onChange: (minor: number | null) => void;
  symbol?: string;
  id?: string;
  className?: string;
}) {
  const [text, setText] = React.useState(minor == null ? "" : (minor / 100).toFixed(2));
  React.useEffect(() => {
    // External changes reset the text; local typing is preserved by the guard.
    const canonical = minor == null ? "" : (minor / 100).toFixed(2);
    setText((cur) => (parse(cur) === minor ? cur : canonical));
  }, [minor]);

  const parse = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : Math.round(n * 100);
  };

  return (
    <div data-slot="amount-input" className={className} onBlur={() => { if (minor != null) setText((minor / 100).toFixed(2)); }}>
      <CurrencyInput id={id} symbol={symbol} value={text}
        onChange={(v) => { setText(v); onChange(parse(v)); }} />
    </div>
  );
}

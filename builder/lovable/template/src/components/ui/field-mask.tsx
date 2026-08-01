import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A field that formats as you type — card numbers, sort codes, reference codes.
 *
 * IT FORMATS BUT NEVER REJECTS. A mask that refuses keystrokes it did not expect
 * makes pasting impossible and traps anybody whose value is a shape the author
 * did not think of. Everything is accepted; the separators are inserted.
 *
 * PASTE IS THE MAIN EVENT, and it is handled by formatting whatever arrives
 * rather than by intercepting the paste — which is what breaks when somebody
 * pastes a value that already has spaces or dashes in it.
 *
 * THE RAW VALUE GOES TO THE CALLER, not the formatted one. Storing "4242 4242"
 * with the spaces is how a lookup fails against a database holding digits, which
 * is the same class of bug as the invite codes stored in their pretty form.
 *
 * `inputMode="numeric"` only when the pattern is digits — a masked reference
 * code with letters needs the full keyboard.
 */
export function FieldMask({ value, onChange, groups, separator = " ", numeric = true, id, className, ...rest }: {
  /** The raw value, without separators. */
  value: string;
  onChange: (raw: string) => void;
  /** Sizes of each group — [4,4,4,4] for a card number. */
  groups: number[];
  separator?: string;
  numeric?: boolean;
  id?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id" | "className">) {
  const clean = (s: string) => (numeric ? s.replace(/\D/g, "") : s.replace(/[^a-zA-Z0-9]/g, ""));
  const format = (raw: string) => {
    const out: string[] = [];
    let i = 0;
    for (const g of groups) {
      if (i >= raw.length) break;
      out.push(raw.slice(i, i + g));
      i += g;
    }
    if (i < raw.length) out.push(raw.slice(i));
    return out.join(separator);
  };
  const max = groups.reduce((a, b) => a + b, 0);
  return (
    <input
      {...rest}
      id={id}
      value={format(value)}
      inputMode={numeric ? "numeric" : undefined}
      autoComplete={rest.autoComplete}
      onChange={(e) => onChange(clean(e.target.value).slice(0, max))}
      className={cn("h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm tabular-nums", className)}
    />
  );
}

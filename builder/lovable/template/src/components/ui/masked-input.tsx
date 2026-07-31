import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An input that formats as you type — sort codes, postcodes, dates, references.
 *
 * The CARET is the whole problem. Reformatting the value on every keystroke and
 * writing it back moves the caret to the end, so anyone editing the middle of a
 * value finds their next character has jumped to the end of the field. The fix
 * is to count how many MASK characters sit before the caret in the new value
 * and restore it there, which is done in a layout effect so it happens before
 * the browser paints and there is no visible jump.
 *
 * The mask is a pattern of `#` for a digit, `A` for a letter and `*` for
 * either; every other character is a literal that the component inserts and the
 * user never types.
 *
 * ONLY use it where the format is genuinely FIXED — a sort code, a card
 * expiry, a reference with a known shape. A character that does not fit the
 * current slot is dropped, silently, which is correct for a fixed format and
 * destroys a variable one: a UK postcode can be `L1 4DS` or `SW1A 1AA`, and
 * masking it as `AA## #AA` turns the first into `LD`. Measured exactly that way.
 * For anything with more than one valid shape, use a plain input and validate.
 *
 * `onChange` hands back the RAW characters as well as the formatted string,
 * because what gets stored is almost never the pretty version — and a form that
 * saves "12-34-56" into a column expecting six digits is the bug this shape
 * exists to prevent.
 */
function applyMask(raw: string, mask: string) {
  let out = "", i = 0;
  for (const m of mask) {
    if (i >= raw.length) break;
    if (m === "#" || m === "A" || m === "*") {
      const c = raw[i];
      const ok = m === "#" ? /\d/.test(c) : m === "A" ? /[a-z]/i.test(c) : /[a-z0-9]/i.test(c);
      if (!ok) { i++; continue; }
      out += c;
      i++;
    } else {
      out += m;
    }
  }
  return out;
}

export function MaskedInput({
  value, onChange, mask, placeholder, id, label, hint, upper, inputMode, className, ...rest
}: {
  value: string;
  onChange: (formatted: string, raw: string) => void;
  mask: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  upper?: boolean;
  className?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "className">) {
  const ref = React.useRef<HTMLInputElement>(null);
  const caret = React.useRef<number | null>(null);
  const slots = React.useMemo(() => new Set(["#", "A", "*"]), []);
  const auto = React.useId();
  const fieldId = id ?? auto;

  React.useLayoutEffect(() => {
    if (caret.current == null || !ref.current) return;
    const want = caret.current;
    caret.current = null;
    let pos = 0, seen = 0;
    while (pos < value.length && seen < want) {
      if (slots.has(mask[pos] ?? "*")) seen++;
      pos++;
    }
    while (pos < value.length && !slots.has(mask[pos] ?? "*")) pos++;
    ref.current.setSelectionRange(pos, pos);
  }, [value, mask, slots]);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const at = e.target.selectionStart ?? e.target.value.length;
    const typed = upper ? e.target.value.toUpperCase() : e.target.value;
    // How many fillable characters sit left of the caret, ignoring literals.
    caret.current = typed.slice(0, at).split("").filter((c, i) => !slots.has(mask[i] ?? "*") ? /[a-z0-9]/i.test(c) : true)
      .filter((c) => /[a-z0-9]/i.test(c)).length;
    const raw = typed.replace(/[^a-z0-9]/gi, "");
    onChange(applyMask(raw, mask), raw);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? <label htmlFor={fieldId} className="text-sm font-medium">{label}</label> : null}
      <input
        {...rest}
        ref={ref}
        id={fieldId}
        value={value}
        onChange={handle}
        inputMode={inputMode ?? (/^[#\W]*$/.test(mask) ? "numeric" : undefined)}
        placeholder={placeholder ?? mask.replace(/[#A*]/g, "_")}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring"
      />
      {hint ? <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

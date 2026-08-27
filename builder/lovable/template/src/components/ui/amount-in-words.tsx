import { cn } from "@/lib/utils";
/**
 * "Two thousand six hundred and fifty pounds" — the written form on a document.
 *
 * REQUIRED ON CHEQUES, CONTRACTS AND MANY INVOICES for a reason that still
 * holds: a figure can be altered by a stroke of a pen and a sentence cannot.
 *
 * ENGLISH ONLY, AND IT SAYS SO. Number-to-words is deeply language-specific —
 * scale words, gender agreement, and the short/long scale all differ — and
 * `Intl` has no API for it. A component pretending to be locale-aware here would
 * be silently wrong in most languages, so this is honest about its scope and the
 * caller can pass `words` directly for anything else.
 *
 * The numeric form stays beside it. The words are the safeguard; the digits are
 * what people read.
 */
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  const h = Math.floor(n / 100), rest = n % 100;
  return `${ONES[h]} hundred${rest ? ` and ${under1000(rest)}` : ""}`;
}

/** English only. Whole numbers up to 999,999,999. */
export function toWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  const whole = Math.floor(n);
  if (whole === 0) return "zero";
  const parts: string[] = [];
  const scales: [number, string][] = [[1_000_000, "million"], [1000, "thousand"]];
  let rest = whole;
  for (const [size, name] of scales) {
    if (rest >= size) {
      parts.push(`${under1000(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest) parts.push(under1000(rest));
  return parts.join(" ");
}

export function AmountInWords({ amount, unit = "pounds", subUnit = "pence", words, className }: {
  amount: number;
  unit?: string; subUnit?: string;
  /** Supply the wording directly for any language other than English. */
  words?: string;
  className?: string;
}) {
  const whole = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - whole) * 100);
  const text = words ?? `${toWords(whole)} ${unit}${cents ? ` and ${toWords(cents)} ${subUnit}` : ""}`;
  return (
    <span data-slot="amount-in-words" className={cn("text-sm", className)}>
      <span className="capitalize">{text}</span>
    </span>
  );
}

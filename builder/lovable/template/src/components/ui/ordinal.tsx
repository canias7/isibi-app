/** "1st", "2nd", "3rd" — from Intl, so it is right outside English too. */
export function Ordinal({ value, className }: { value: number; className?: string }) {
  const suffixes: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };
  const rule = new Intl.PluralRules(undefined, { type: "ordinal" }).select(value);
  return <span className={className ? className + " tabular-nums" : "tabular-nums"}>
    {value}{suffixes[rule] ?? "th"}
  </span>;
}

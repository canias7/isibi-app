/**
 * "1 booking" / "2 bookings", correctly.
 *
 * Intl.PluralRules rather than appending an s: languages with more than two
 * plural forms exist, and the s-rule silently produces nonsense in them.
 */
export function Plural({ count, one, other, few, showCount = true, className }: {
  count: number; one: string; other: string; few?: string;
  showCount?: boolean; className?: string;
}) {
  const rule = new Intl.PluralRules(undefined).select(count);
  const word = rule === "one" ? one : rule === "few" && few ? few : other;
  return <span data-slot="plural" className={className}>{showCount ? `${count} ${word}` : word}</span>;
}

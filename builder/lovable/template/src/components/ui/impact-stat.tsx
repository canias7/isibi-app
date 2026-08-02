import { cn } from "@/lib/utils";
/**
 * One number, and the sentence that makes it mean something.
 *
 * A NUMBER ALONE IS NOT AN IMPACT CLAIM. "14,200" is trivia; "14,200 hot meals,
 * which is every weekday since March" is evidence. So `meaning` is required
 * rather than optional — a charity that cannot say what its number means should
 * not be printing the number, and making the field optional is how that
 * happens by accident.
 *
 * `period` and `source` are the two things that turn a claim into a checkable
 * one, and a reader who wants to check is exactly the reader worth convincing.
 * The source renders as plain text, not a badge: it is provenance, not a prize.
 *
 * The value is a STRING, deliberately. "14,200", "1 in 4" and "£1.9m" are all
 * impact figures and only the first is a number; formatting is the caller's
 * decision because only they know whether the thousands separator belongs.
 */
export function ImpactStat({ value, meaning, period, source, className }: {
  /** Pre-formatted: "14,200", "1 in 4", "£1.9m". */
  value: string;
  /** What it means. Required — a number without one is trivia. */
  meaning: string;
  /** "in 2025", "since March". */
  period?: string;
  /** Where it comes from, so somebody can check. */
  source?: string;
  className?: string;
}) {
  return (
    <div className={cn("", className)}>
      <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{value}</p>
      <p className="mt-2 max-w-sm text-base leading-relaxed">{meaning}</p>
      {(period || source) && (
        <p className="mt-2 text-sm text-muted-foreground">
          {period}
          {period && source && " · "}
          {source}
        </p>
      )}
    </div>
  );
}
/** Several of them in a row, ruled apart rather than boxed. */
export function ImpactStats({ items, className }: {
  items: { value: string; meaning: string; period?: string; source?: string }[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={cn("grid gap-8 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((i) => (
        <div key={i.value + i.meaning} className="border-t border-border pt-6">
          <ImpactStat {...i} />
        </div>
      ))}
    </div>
  );
}

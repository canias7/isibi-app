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
 *
 * IT WRAPS RATHER THAN OVERFLOWS. At 48px a six-figure value is about 180px
 * wide, and in a narrow cell it used to run straight out of its own box and
 * across the next stat: "£60,000" and "1,340" rendered as "£60,0001,340", which
 * is not a clipped figure anybody would query but a fourth number that does not
 * exist. A wrapped value is ugly; two collided values are a lie.
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
      <p className="text-4xl font-semibold tracking-tight tabular-nums break-words sm:text-5xl">{value}</p>
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
/**
 * Several of them in a row, ruled apart rather than boxed.
 *
 * HOW MANY COLUMNS IS THE CALLER'S DECISION. Tailwind's breakpoints are the
 * VIEWPORT's, so a hard-coded `lg:grid-cols-3` still made three columns inside
 * a half-width aside on a 1280px screen — about 120px each, which is narrower
 * than a single six-figure number. Third component in this kit to have had
 * exactly this bug; `gallery` has taken `columns` all along and has never had
 * it once.
 */
export function ImpactStats({ items, columns = 3, className }: {
  items: { value: string; meaning: string; period?: string; source?: string }[];
  /** How many across at the widest. The parent knows its room; the CSS cannot. */
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  if (!items.length) return null;
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" }[columns];
  return (
    <div className={cn("grid gap-8", cols, className)}>
      {items.map((i) => (
        <div key={i.value + i.meaning} className="min-w-0 border-t border-border pt-6">
          <ImpactStat {...i} />
        </div>
      ))}
    </div>
  );
}

import { cn } from "@/lib/utils";
/**
 * How complete a translation is, with the untranslated count spelled out.
 *
 * THE MISSING COUNT MATTERS MORE THAN THE PERCENTAGE. "94% translated" sounds
 * finished; "62 strings missing" is a job somebody can pick up. And in a
 * fourteen-language table the percentages all look similar while the counts do
 * not.
 *
 * STALE IS A THIRD STATE, and it is the one that causes wrong translations
 * rather than missing ones. A string whose English source changed after it was
 * translated still HAS a translation — an out-of-date one, which is worse than
 * a gap because nothing falls back.
 *
 * REVIEWED IS SEPARATED FROM TRANSLATED where the caller tracks it. Machine or
 * unreviewed translations shipped as finished is how a product tells customers
 * something it did not mean.
 *
 * `<progress>` for the bar, so the value and maximum are available without
 * three ARIA attributes — the same choice `survey-progress` makes.
 */
export function TranslationStatus({ locale, translated, total, stale = 0, unreviewed = 0, className }: {
  /** Language name, in its own language. */
  locale: string;
  translated: number;
  total: number;
  /** Translated but the source has since changed. */
  stale?: number;
  /** Translated but not checked by a person. */
  unreviewed?: number;
  className?: string;
}) {
  if (total <= 0) return null;
  const missing = Math.max(0, total - translated);
  const pct = Math.round((translated / total) * 100);
  return (
    <div data-slot="translation-status" className={cn("space-y-1", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{locale}</span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
        {missing > 0 && (
          <span className="tabular-nums">{missing.toLocaleString()} missing</span>
        )}
        {stale > 0 && (
          <span className="font-medium tabular-nums">{stale.toLocaleString()} out of date</span>
        )}
        {unreviewed > 0 && (
          <span className="tabular-nums text-muted-foreground">{unreviewed.toLocaleString()} unchecked</span>
        )}
      </p>
      <progress value={translated} max={total} aria-label={`${locale} translation progress`}
        className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-foreground" />
      {stale > 0 && (
        <p className="text-xs text-muted-foreground">
          Out-of-date strings still show — they do not fall back to English.
        </p>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
/**
 * A string with no translation, shown in the source language and marked as
 * such.
 *
 * THE FALLBACK IS MARKED RATHER THAN HIDDEN. Rendering the English silently is
 * how untranslated strings survive for years — nobody reports them because
 * nothing distinguishes them from a deliberate English term. A dotted underline
 * and a `lang` attribute make them countable.
 *
 * `lang` ON THE FALLBACK IS THE PART THAT MATTERS MOST. Inside a German page,
 * an English string without it is read aloud with German phonemes — which is
 * unintelligible, and far worse for a screen reader user than for a sighted one
 * who simply sees a foreign word.
 *
 * THE KEY IS AVAILABLE IN `title` FOR TRANSLATORS, so somebody looking at a
 * running product can find the string to fix without hunting through files.
 *
 * IT NEVER SHOWS THE RAW KEY AS THE TEXT. `checkout.button.submit` on screen is
 * worse than the wrong language, and it is what most i18n libraries do by
 * default.
 */
export function MissingTranslation({ children, sourceLang = "en", stringKey, mark = true, className }: {
  /** The source-language text. */
  children: React.ReactNode;
  /** BCP-47 tag of the text being shown. */
  sourceLang?: string;
  /** For translators. */
  stringKey?: string;
  /** Set false in production if the marking is unwanted. */
  mark?: boolean;
  className?: string;
}) {
  return (
    <span data-slot="missing-translation" lang={sourceLang} title={stringKey}
      className={cn(mark && "underline decoration-dotted decoration-from-font underline-offset-4", className)}>
      {children}
      {mark && <span className="sr-only"> (not translated)</span>}
    </span>
  );
}

import { cn } from "@/lib/utils";
/**
 * "This is only available in English" — a language gap, stated rather than
 * silently substituted.
 *
 * IT SAYS SO IN BOTH LANGUAGES, or the notice is unreadable by exactly the
 * person it is for. A message explaining a missing translation, written only in
 * the language they do not read, is the purest form of this mistake.
 *
 * `lang` IS SET ON THE FOREIGN TEXT. Without it a screen reader pronounces
 * French with English phonemes, which is unintelligible — and this component
 * exists specifically at the boundary where two languages meet, so it is the
 * one place that attribute is never optional.
 *
 * IT DOES NOT OFFER MACHINE TRANSLATION UNLESS THE CALLER HAS IT. An
 * auto-translate button that is really a link to a third party ships the
 * content — often somebody's personal details — to a service the reader never
 * chose.
 *
 * IT NEVER BLOCKS. The content is shown; this is a note above it, because
 * something readable-with-effort beats nothing at all.
 */
export function LanguageFallback({ shownIn, wantedIn, noteInShown, noteInWanted, action, className }: {
  /** Language the content is in — "English". */
  shownIn: string;
  /** Language they asked for — "Polski". */
  wantedIn?: string;
  /** The explanation, written in `shownIn`. */
  noteInShown?: string;
  /** The same explanation, written in `wantedIn`. */
  noteInWanted?: string;
  /** BCP-47 tags, for correct pronunciation. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="language-fallback" className={cn("space-y-0.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs", className)}>
      <p className="text-muted-foreground">
        {noteInShown ?? `This is only available in ${shownIn}.`}
      </p>
      {noteInWanted && (
        <p lang={wantedIn} className="text-muted-foreground">{noteInWanted}</p>
      )}
      {action && <div className="pt-0.5">{action}</div>}
    </div>
  );
}

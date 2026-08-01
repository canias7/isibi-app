import { cn } from "@/lib/utils";
/**
 * The note a translator needs to translate one string correctly.
 *
 * "Book" IS A VERB OR A NOUN AND THE TRANSLATOR CANNOT TELL. That single
 * ambiguity is the most expensive thing in software translation — in most
 * languages the two are unrelated words, and a wrong guess ships a button
 * labelled with a physical object. Everything here exists to resolve it.
 *
 * A CHARACTER LIMIT IS PART OF THE BRIEF. German runs about 30% longer than
 * English, so a string that fits a button in one language overflows in another
 * — and the translator is the only person who can shorten it, if told.
 *
 * PLACEHOLDERS ARE LISTED WITH WHAT THEY CONTAIN. `{0}` tells a translator
 * nothing; "{0} is the customer's first name" lets them put it in the right
 * place, which in many languages is not where English puts it.
 *
 * IT IS SHOWN WITH THE STRING, not in a separate glossary. A note nobody sees
 * at the moment of translating is a note nobody reads.
 */
export function TranslatorNote({ context, maxLength, placeholders = [], where, className }: {
  /** What it means — "verb, on a button". */
  context: string;
  /** Characters available in the layout. */
  maxLength?: number;
  /** Each placeholder and what it holds. */
  placeholders?: { token: string; holds: string }[];
  /** Where it appears — "the confirmation email subject". */
  where?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs", className)}>
      <p><span className="text-muted-foreground">Means:</span> {context}</p>
      {where && <p><span className="text-muted-foreground">Appears in:</span> {where}</p>}
      {maxLength !== undefined && (
        <p>
          <span className="text-muted-foreground">Fits:</span>{" "}
          <span className="tabular-nums">{maxLength}</span> characters — longer will be cut off
        </p>
      )}
      {placeholders.length > 0 && (
        <ul className="space-y-0.5">
          {placeholders.map((p) => (
            <li key={p.token}>
              <code className="font-mono">{p.token}</code>
              <span className="text-muted-foreground"> is {p.holds}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

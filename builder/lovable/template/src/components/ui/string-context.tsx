import { cn } from "@/lib/utils";
/**
 * The neighbouring strings, so a translation reads as a sentence.
 *
 * STRINGS ARE TRANSLATED IN ISOLATION AND READ IN SEQUENCE. A label, its hint
 * and its error are written by three different translators on three different
 * days, and the result is three registers in one form — polite, terse and
 * technical. Showing the neighbours is what makes them agree.
 *
 * THE DIFFERENCE FROM `translator-note` IS WHAT IT CARRIES. That is the brief
 * for one string; this is the strings AROUND it. Both are needed and neither
 * substitutes for the other.
 *
 * THE STRING BEING WORKED ON IS MARKED, in weight rather than colour, and the
 * others are muted — a context panel where everything looks equal is one
 * somebody edits the wrong line in.
 *
 * `lang` ON THE WHOLE BLOCK, since these are source-language strings shown
 * inside a translator's own interface — the mixed-language case that always
 * needs it.
 */
export function StringContext({ before = [], current, after = [], sourceLang = "en", label = "Around it", className }: {
  before?: string[];
  current: string;
  after?: string[];
  sourceLang?: string;
  label?: string;
  className?: string;
}) {
  if (!before.length && !after.length) return null;
  return (
    <div data-slot="string-context" className={cn("space-y-1", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <ul lang={sourceLang} className="space-y-0.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm">
        {before.map((s, i) => <li key={`b${i}`} className="text-muted-foreground">{s}</li>)}
        <li className="font-medium">{current}</li>
        {after.map((s, i) => <li key={`a${i}`} className="text-muted-foreground">{s}</li>)}
      </ul>
    </div>
  );
}

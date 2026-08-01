import { KeyCap } from "@/components/ui/key-cap";
import { cn } from "@/lib/utils";
/**
 * A whole shortcut — ⌘ K, or G then I.
 *
 * TWO KINDS OF SHORTCUT, and confusing them is why people give up on them.
 * `mod+k` is held together; `g i` is pressed in sequence. Rendered identically
 * they teach the wrong gesture, so the separator says which: nothing between
 * held keys, the word "then" between sequential ones.
 *
 * The `sr-only` reading spells the whole thing out — "Command or Control plus
 * K" — because a row of `<kbd>` elements is otherwise announced as a stream of
 * disconnected letters.
 *
 * Parsing is deliberately tiny: `+` joins held keys, a space separates steps.
 * That covers every shortcut a business site has, and a fuller grammar would be
 * a parser nobody asked for.
 */
export function KbdChord({ chord, className }: {
  /** "mod+k" · "g i" · "mod+shift+p" */
  chord: string;
  className?: string;
}) {
  const steps = chord.trim().split(/\s+/).filter(Boolean).map((s) => s.split("+").filter(Boolean));
  if (!steps.length) return null;

  const say = steps
    .map((keys) => keys.join(" plus "))
    .join(", then ");

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="sr-only">{say}</span>
      {steps.map((keys, i) => (
        <span key={i} aria-hidden className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="mr-1 text-xs text-muted-foreground">then</span>}
          {keys.map((k, j) => <KeyCap key={j} k={k} />)}
        </span>
      ))}
    </span>
  );
}

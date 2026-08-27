import { cn } from "@/lib/utils";
/**
 * Two rules that fight, and what actually happens when they do.
 *
 * IT STATES THE OUTCOME, not just that a clash exists. "These rules overlap" is
 * a warning nobody can act on; "both send a text, so the customer gets two" is
 * the consequence, and it is the sentence that decides whether the overlap
 * matters at all — sometimes it genuinely does not.
 *
 * THREE KINDS, BECAUSE THEY NEED DIFFERENT ANSWERS. Duplicate work is annoying;
 * contradictory actions leave a record in whichever state won the race, which
 * is not reproducible; a loop is the one that runs until something falls over.
 * A single generic warning collapses all three.
 *
 * A LOOP IS THE ONE WORTH SHOUTING ABOUT, and gets `role="alert"` where the
 * others are `status`. A rule whose action fires its own trigger will keep
 * going, and the cost is real money on whatever it sends.
 *
 * IT NAMES BOTH RULES AND OFFERS TO OPEN EITHER. Somebody who wrote one of them
 * six months ago needs to see the other before deciding which to change.
 */
const KINDS = {
  duplicate: { word: "Both rules do the same thing", note: "Whatever they send goes out twice." },
  contradict: { word: "These rules disagree", note: "Whichever runs last wins, and that is not predictable." },
  loop: { word: "These rules set each other off", note: "This will keep running until it is stopped." },
} as const;

export function RuleConflict({ kind, a, b, outcome, onOpen, className }: {
  kind: keyof typeof KINDS;
  a: { id: string; name: string };
  b: { id: string; name: string };
  /** The caller's own sentence, if it knows better than the default. */
  outcome?: string;
  onOpen?: (id: string) => void;
  className?: string;
}) {
  const k = KINDS[kind];
  return (
    <div data-slot="rule-conflict" role={kind === "loop" ? "alert" : "status"}
      className={cn("rounded-md border px-3 py-2 text-sm",
        kind === "loop" ? "border-foreground/40 bg-muted/40" : "border-border", className)}>
      <p className="font-medium">{k.word}</p>
      <p className="text-xs text-muted-foreground">{outcome ?? k.note}</p>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {[a, b].map((r) => (
          onOpen
            ? <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="underline underline-offset-2">{r.name}</button>
            : <span key={r.id}>{r.name}</span>
        ))}
      </p>
    </div>
  );
}

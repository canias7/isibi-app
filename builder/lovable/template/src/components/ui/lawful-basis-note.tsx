import { cn } from "@/lib/utils";
/**
 * Why a business is allowed to hold this — and what that means for you.
 *
 * THE BASIS DECIDES WHAT THE READER CAN DO, which is why this is not just a
 * legal footnote. Data held because they consented can be withdrawn; data held
 * to perform a contract cannot be, and asking is a wasted round trip for both
 * sides. Each basis therefore states its own consequence.
 *
 * THE CONSEQUENCE IS THE HEADLINE AND THE TERM IS THE FOOTNOTE, not the other
 * way round. "You can withdraw this at any time" is what somebody needs;
 * "consent" is the word their lawyer needs, and it goes in small print beside
 * it.
 *
 * IT NAMES THE BASIS BUT NOT A STATUTE, deliberately — the six bases are a
 * shared vocabulary across many regimes, while article numbers belong to one
 * and would be wrong everywhere else. A caller with a specific citation puts it
 * in `note`.
 *
 * One line, sitting under a field or a section, like `retention-note`.
 */
const BASES = {
  consent: { word: "your consent", means: "You can withdraw this at any time." },
  contract: { word: "our contract with you", means: "We need this to provide what you asked for." },
  legal: { word: "a legal obligation", means: "We are required to keep this." },
  vital: { word: "protecting someone's life", means: "Used only in an emergency." },
  public: { word: "a task in the public interest", means: "You can object to this." },
  legitimate: { word: "our legitimate interests", means: "You can object to this." },
} as const;

export function LawfulBasisNote({ basis, note, className }: {
  basis: keyof typeof BASES;
  note?: string;
  className?: string;
}) {
  const b = BASES[basis];
  return (
    <p data-slot="lawful-basis-note" className={cn("text-xs text-muted-foreground", className)}>
      <span className="text-foreground">{b.means}</span>
      <span> Held on the basis of {b.word}.</span>
      {note && <span> {note}</span>}
    </p>
  );
}

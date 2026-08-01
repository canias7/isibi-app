import { cn } from "@/lib/utils";
/**
 * What goes in a bin — and, more usefully, what does not.
 *
 * THE "NOT THIS" LIST IS THE ONE PEOPLE READ. Everybody knows paper is
 * recyclable; nobody knows about the plastic film, the greasy box or the drinks
 * carton, and those are what actually contaminate a load. Leading with what is
 * accepted is why the wrong things keep going in.
 *
 * IT NAMES THE COMMON MISTAKES SPECIFICALLY, because "no plastics" is useless
 * where some plastics are fine — the bag, the lid and the tray have different
 * answers and the general rule teaches nothing.
 *
 * IT IS IDENTIFIED BY COLOUR AND BY NAME. Bin colours differ between
 * neighbouring councils, so a page that says only "the green bin" is unusable to
 * anybody who has just moved — which is exactly who is reading it.
 *
 * WHAT HAPPENS TO CONTAMINATED LOADS IS STATED. "The whole lorry goes to
 * incineration" changes behaviour in a way a polite request does not.
 */
// A sentence-embedded list needs a conjunction, not a comma: "does not
// include rubble, waste burned for energy" reads as a truncated list.
// `Intl.ListFormat` also gets the separator right outside English.
const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

export function BinType({ name, colour, accepted = [], notAccepted = [], commonMistakes = [], contaminationNote, className }: {
  name: string;
  /** Named as well as coloured — colours differ between councils. */
  colour?: string;
  accepted?: string[];
  notAccepted?: string[];
  /** The specific things people get wrong. */
  commonMistakes?: string[];
  /** What a contaminated load costs. */
  contaminationNote?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{name}</span>
        {colour && <span className="text-muted-foreground"> · the {colour} one</span>}
      </p>
      {notAccepted.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs font-medium">Not in this bin</p>
          <ul className="text-xs">
            {notAccepted.map((n, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true" className="text-muted-foreground">—</span><span>{n}</span></li>
            ))}
          </ul>
        </div>
      )}
      {commonMistakes.length > 0 && (
        <p className="text-xs">Most often got wrong: {commonMistakes.join("; ")}.</p>
      )}
      {accepted.length > 0 && (
        <p className="text-xs text-muted-foreground">Yes to {AND.format(accepted)}.</p>
      )}
      {contaminationNote && <p className="text-xs">{contaminationNote}</p>}
    </div>
  );
}

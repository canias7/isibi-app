import { cn } from "@/lib/utils";
/**
 * A rule stated as a sentence: when this, if that, do this.
 *
 * PROSE, NOT A DIAGRAM. Somebody scanning fifteen automations needs to know
 * what each does without opening it, and a row of icons or a collapsed
 * flowchart answers nothing. "When a booking is made · if it is a Saturday ·
 * send a text and add a task" is readable at a glance and out loud on a call.
 *
 * THE CONDITIONS ARE LABELLED "if" AND JOINED EXPLICITLY. Two conditions listed
 * side by side are ambiguous between and and or — and that ambiguity is the
 * single most common misunderstanding about a rule somebody else wrote, usually
 * discovered when it fires far more or far less than expected.
 *
 * A RULE WITH NO CONDITIONS SAYS SO, rather than showing a gap. "Every time"
 * is a meaningful and slightly alarming fact that deserves to be stated — and
 * it replaces the "then" rather than preceding it, or the sentence reads "every
 * time, then email me", which is how it first rendered.
 *
 * READ-ONLY BY DESIGN — `condition-row` and `trigger-picker` do the editing.
 * A summary that is also a form is one somebody changes while reading.
 */
export function RuleSummary({ trigger, conditions = [], actions, join = "and", className }: {
  /** "a booking is made". */
  trigger: string;
  conditions?: string[];
  actions: string[];
  join?: "and" | "or";
  className?: string;
}) {
  const list = (xs: string[], word: string) =>
    xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} ${word} ${xs[xs.length - 1]}`;
  return (
    <p className={cn("text-sm", className)}>
      <span className="text-muted-foreground">When </span>
      <span className="font-medium">{trigger}</span>
      {conditions.length > 0 ? (
        <>
          <span className="text-muted-foreground">, if </span>
          <span className="font-medium">{list(conditions, join)}</span>
          <span className="text-muted-foreground">, then </span>
        </>
      ) : (
        <span className="text-muted-foreground">, every time, </span>
      )}
      <span className="font-medium">{list(actions, "and")}</span>
    </p>
  );
}

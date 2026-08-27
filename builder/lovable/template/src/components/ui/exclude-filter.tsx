import { cn } from "@/lib/utils";
/**
 * A filter value in one of three states: ignored, required, excluded.
 *
 * EXCLUSION IS THE MISSING THIRD STATE. Every checkbox filter can say "show me
 * cancelled" and none can say "show me everything except cancelled" — which is
 * the more common request, and the workaround is ticking the other eleven boxes
 * and re-ticking them whenever a twelfth appears.
 *
 * THE THREE STATES ARE MARKED BY SYMBOL AND WORD, never by colour. `+`
 * required, `−` excluded, nothing for off, with the state in the accessible
 * name — a green/red toggle is the usual approach and it is unreadable in
 * greyscale and to plenty of readers.
 *
 * IT CYCLES off → include → exclude → off, so one control does all three and
 * there is always a way back to neutral. A pair of checkboxes for the same
 * value admits the nonsense state of both ticked at once.
 *
 * A BUTTON WITH AN EXPLICIT `aria-label`, not `aria-pressed` — pressed is a
 * boolean and this has three states, so the label carries the truth.
 */
export type ExcludeState = "off" | "include" | "exclude";

const NEXT: Record<ExcludeState, ExcludeState> = { off: "include", include: "exclude", exclude: "off" };
const SIGN: Record<ExcludeState, string> = { off: "", include: "+", exclude: "−" };
const WORD: Record<ExcludeState, string> = { off: "not filtered", include: "required", exclude: "excluded" };

export function ExcludeFilter({ label, state, onChange, count, className }: {
  label: string;
  state: ExcludeState;
  onChange: (next: ExcludeState) => void;
  count?: number;
  className?: string;
}) {
  return (
    <button data-slot="exclude-filter" type="button" onClick={() => onChange(NEXT[state])}
      aria-label={`${label}, ${WORD[state]}`}
      className={cn("flex w-full items-center gap-2 rounded px-1.5 py-1 text-start text-sm hover:bg-muted", className)}>
      <span aria-hidden="true"
        className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded border text-xs leading-none",
          state === "off" ? "border-border" : "border-foreground bg-foreground text-background")}>
        {SIGN[state]}
      </span>
      <span className={cn("min-w-0 truncate", state === "exclude" && "line-through decoration-from-font")}>{label}</span>
      {count !== undefined && (
        <span className="ms-auto shrink-0 text-xs tabular-nums text-muted-foreground">{count.toLocaleString()}</span>
      )}
    </button>
  );
}

import { useState , useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Typing a page number instead of clicking Next forty times.
 *
 * THE ONLY WAY THROUGH A LONG LIST. Numbered pagination collapses to
 * "1 2 3 … 97" and the middle is unreachable, so a 200-page result set has
 * exactly two navigable ends. This is the control that fixes it and it is
 * almost never there.
 *
 * IT CLAMPS RATHER THAN REFUSING. Typing 500 into a 97-page list goes to 97,
 * because the intention is unambiguous — a validation error there is a lecture
 * about something the component can simply do.
 *
 * NON-NUMERIC INPUT REVERTS TO THE CURRENT PAGE on submit rather than
 * navigating to NaN, which is the standard failure and renders an empty table
 * with no explanation.
 *
 * A `<form>` so Enter works — that is how this control is used, and a
 * number field with no submit handler swallows the key.
 */
export function JumpToPage({ page, pageCount, onJump, label = "Go to page", className }: {
  page: number;
  pageCount: number;
  onJump: (page: number) => void;
  label?: string;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [draft, setDraft] = useState("");
  if (pageCount <= 1) return null;
  return (
    <form className={cn("inline-flex items-center gap-2 text-sm", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(draft);
        if (!draft.trim() || !Number.isFinite(n)) { setDraft(""); return; }
        onJump(Math.min(pageCount, Math.max(1, Math.round(n))));
        setDraft("");
      }}>
      <label htmlFor={uid + "-jump-page"} className="text-muted-foreground">{label}</label>
      <input id={uid + "-jump-page"} type="number" inputMode="numeric" min={1} max={pageCount}
        value={draft} placeholder={String(page)} onChange={(e) => setDraft(e.target.value)}
        className="h-8 w-16 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      <span className="text-muted-foreground">of {pageCount.toLocaleString()}</span>
    </form>
  );
}

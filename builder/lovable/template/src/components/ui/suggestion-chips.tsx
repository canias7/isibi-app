import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The row of "try asking…" chips.
 *
 * They DISAPPEAR once the conversation starts. Suggestions are for the empty
 * state — the hardest moment in any chat product is the blank box — and a row
 * of generic prompts under every answer is clutter that competes with the
 * follow-up somebody was already typing.
 *
 * Each chip is a full, sendable QUESTION, not a topic. "Opening hours" leaves
 * the person to write the sentence anyway; "What time do you close on
 * Saturdays?" is one press. That is the entire value.
 *
 * They wrap rather than scrolling sideways. A horizontal strip hides the later
 * ones behind a gesture nobody performs on a desktop, and there are only ever
 * a handful.
 *
 * `busy` disables them, because a chip pressed mid-answer sends a second
 * question that races the first — and the answers arrive interleaved.
 */
export function SuggestionChips({ suggestions, onPick, busy, title, className }: {
  suggestions: string[];
  onPick: (text: string) => void;
  busy?: boolean;
  title?: React.ReactNode;
  className?: string;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {title ? <p className="text-xs text-muted-foreground">{title}</p> : null}
      <ul className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <li key={s}>
            <button type="button" onClick={() => onPick(s)} disabled={busy}
              className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-start text-xs hover:bg-muted disabled:pointer-events-none disabled:opacity-50">
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

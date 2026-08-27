import * as React from "react";
import { cn, divide } from "@/lib/utils";
/**
 * How full the conversation's context window is.
 *
 * It says what happens when it FILLS — "the oldest messages stop being taken
 * into account" — because that is a surprising and invisible failure. A long
 * conversation quietly forgetting its beginning looks like the model getting
 * worse, and nobody connects it to length without being told.
 *
 * Hidden entirely below a threshold. Most conversations never approach the
 * limit, and a permanent gauge for a thing that will not happen is noise that
 * makes the warning unrecognisable when it does.
 *
 * The segments show what the space is SPENT ON — instructions, attachments,
 * conversation — because those have different remedies. Twelve thousand tokens
 * of attached PDF is fixed by removing the PDF; a long conversation is fixed by
 * starting a new one, and the meter is the only thing that can tell them apart.
 */
export function ContextMeter({ segments, limit, showAbove = 0.5, onNewChat, className }: {
  segments: { key: string; label: React.ReactNode; tokens: number }[];
  limit: number;
  showAbove?: number;
  onNewChat?: () => void;
  className?: string;
}) {
  const used = segments.reduce((n, s) => n + Math.max(0, s.tokens), 0);
  const frac = limit > 0 ? used / limit : 0;
  if (frac < showAbove) return null;
  const full = frac >= 0.95;

  return (
    <div data-slot="context-meter" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">Conversation length</span>
        <span className="text-muted-foreground tabular-nums">{Math.round(Math.min(1, frac) * 100)}% full</span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {segments.map((s, i) => (
          <div key={s.key}
            style={{ width: `${Math.min(100, divide(Math.max(0, s.tokens), limit) * 100)}%` }}
            className={cn("h-full", i % 2 === 0 ? "bg-foreground" : "bg-muted-foreground")} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {segments.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1">
            <span aria-hidden className={cn("size-1.5 rounded-full", i % 2 === 0 ? "bg-foreground" : "bg-muted-foreground")} />
            {s.label} <span className="tabular-nums">{s.tokens.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {full
          ? "This conversation is full — the oldest messages are no longer being taken into account."
          : "When this fills up, the oldest messages stop being taken into account."}
        {onNewChat ? (
          <>
            {" "}
            <button type="button" onClick={onNewChat}
              className="cursor-pointer font-medium text-foreground underline underline-offset-2">
              Start a new chat
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}

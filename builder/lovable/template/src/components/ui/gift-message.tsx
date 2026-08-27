import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The card that goes in the box — previewed as it will be printed.
 *
 * IT IS PRINTED BY A MACHINE ON A SMALL CARD, so the constraint is LINES,
 * not characters: a 200-character limit still lets somebody write a wall
 * that gets truncated mid-word on the card. The preview shows the real card
 * shape and the real line count, and over-long lines are flagged where they
 * will break.
 *
 * "FROM" IS A SEPARATE FIELD, because the most common heartbreak in gifting
 * is a card arriving unsigned — the recipient has no idea who sent it, and
 * the shop cannot tell them without breaking the buyer's privacy.
 *
 * Emoji and accents are allowed here, unlike engraving — a card printer
 * handles them and refusing them would be cargo-culting the other component.
 */
export function GiftMessage({ message, from, onChange, maxLines = 6, perLine = 32, className }: {
  message: string;
  from: string;
  onChange: (v: { message: string; from: string }) => void;
  maxLines?: number;
  perLine?: number;
  className?: string;
}) {
  const lines = message.split("\n");
  const tooMany = lines.length > maxLines;
  const longOnes = lines.map((l, i) => ({ i, over: l.length > perLine })).filter((x) => x.over);

  return (
    <div data-slot="gift-message" className={cn("flex flex-col gap-2", className)}>
      <label className="flex flex-col gap-1 text-sm">
        Message
        <textarea value={message} rows={4}
          onChange={(e) => onChange({ message: e.target.value, from })}
          className="resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        From
        <input value={from} onChange={(e) => onChange({ message, from: e.target.value })}
          placeholder="Your name"
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      {!from.trim() ? (
        <p className="text-[11px] font-medium">Unsigned cards arrive with no idea who sent them.</p>
      ) : null}
      {/* The real card shape - characters are the wrong unit. */}
      <figure className="flex flex-col gap-1">
        <figcaption className="text-[11px] text-muted-foreground">How the card will print</figcaption>
        <div className="rounded border border-border bg-muted/40 p-3" style={{ aspectRatio: "3/2" }}>
          <pre className="whitespace-pre-wrap font-serif text-xs leading-relaxed">
            {lines.slice(0, maxLines).map((l, i) => (
              <span key={i} className={cn("block", longOnes.some((x) => x.i === i) && "underline decoration-dotted")}>
                {l || " "}
              </span>
            ))}
            {from.trim() ? <span className="mt-2 block">— {from}</span> : null}
          </pre>
        </div>
      </figure>
      {tooMany ? <p className="text-xs font-medium">Only the first {maxLines} lines fit on the card.</p> : null}
      {longOnes.length ? <p className="text-xs text-muted-foreground">Underlined lines are too long and will wrap.</p> : null}
    </div>
  );
}

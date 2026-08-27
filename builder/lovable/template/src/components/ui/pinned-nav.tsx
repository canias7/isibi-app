import * as React from "react";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Items somebody has pinned to the top of a navigation.
 *
 * PINNING IS DELIBERATE AND RECENTS ARE AUTOMATIC — that is the whole reason
 * this is separate from `recent-nav`. A pinned item never falls off the list,
 * which is what makes it worth pinning; merging the two would let activity push
 * out a deliberate choice.
 *
 * The pin button is on EVERY item, pinned or not, and it is a toggle with
 * `aria-pressed`. A pin that can only be undone from a menu somewhere else
 * makes people pin nothing.
 *
 * Pinned items keep the ORDER they were pinned in, not alphabetical. Somebody
 * who pins three things is building a short list they will navigate by
 * position, and re-sorting it moves the target under their cursor.
 *
 * An empty state explains what pinning is FOR rather than saying "no items" —
 * this is a feature nobody uses until they know it exists.
 */
export function PinnedNav({ items, onPick, onUnpin, title = "Pinned", empty, className }: {
  items: { key: string; label: string; hint?: string }[];
  onPick: (key: string) => void;
  onUnpin: (key: string) => void;
  title?: React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
}) {
  return (
    <nav data-slot="pinned-nav" aria-label={typeof title === "string" ? title : "Pinned"} className={cn("flex flex-col gap-1", className)}>
      <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <Pin aria-hidden className="size-3" /> {title}
      </p>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          {empty ?? "Pin the pages you use most and they will stay here."}
        </p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.key} className="group/p flex items-center">
              <button type="button" onClick={() => onPick(i.key)}
                className="min-w-0 flex-1 cursor-pointer truncate rounded px-2 py-1 text-start text-sm hover:bg-muted">
                {i.label}
                {i.hint ? <span className="ms-1.5 text-xs text-muted-foreground">{i.hint}</span> : null}
              </button>
              <button type="button" onClick={() => onUnpin(i.key)}
                aria-pressed="true" aria-label={`Unpin ${i.label}`}
                className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/p:opacity-100 focus-visible:opacity-100 hover:text-foreground">
                <PinOff aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

export function PinButton({ pinned, label, onToggle, className }: {
  pinned: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button data-slot="pin-button" type="button" onClick={onToggle} aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${label}` : `Pin ${label}`}
      className={cn("cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground", className)}>
      {pinned ? <Pin aria-hidden className="size-3.5 fill-current" /> : <Pin aria-hidden className="size-3.5" />}
    </button>
  );
}

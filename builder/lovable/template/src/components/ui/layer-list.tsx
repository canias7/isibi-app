import * as React from "react";
import { Eye, EyeOff, Lock, Unlock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The layers panel — visibility, locking, nesting, order.
 *
 * IT IS DRAWN TOP-TO-BOTTOM AS FRONT-TO-BACK, which is the opposite of the
 * array order every renderer uses. Every drawing tool shows it this way and
 * getting it wrong makes "bring to front" appear to move things down. The
 * reversal happens here, once, rather than at every call site.
 *
 * A HIDDEN layer stays in the list, dimmed. Removing it from view means the
 * only way back is a menu somewhere else, and nothing on screen says the layer
 * exists.
 *
 * A LOCKED layer cannot be selected, and the lock is a separate control from
 * visibility — they are different intentions ("I do not want to see this" and
 * "I do not want to change this by accident") and tools that conflate them are
 * constantly frustrating.
 *
 * Both toggles are `aria-pressed` buttons with names that say what they do, not
 * icons alone: an eye with a line through it is a well-known glyph and an
 * unnamed button all the same.
 */
export type Layer = { id: string; name: string; hidden?: boolean; locked?: boolean; depth?: number; children?: number };

export function LayerList({
  layers, selected, onSelect, onToggleHidden, onToggleLocked, className,
}: {
  layers: Layer[];
  selected?: string;
  onSelect: (id: string) => void;
  onToggleHidden?: (id: string) => void;
  onToggleLocked?: (id: string) => void;
  className?: string;
}) {
  // Front-to-back, which is how every drawing tool shows it.
  const shown = React.useMemo(() => layers.slice().reverse(), [layers]);

  return (
    <ul className={cn("flex flex-col text-sm", className)}>
      {shown.map((l) => (
        <li key={l.id}
          className={cn("flex items-center gap-1 rounded px-1 py-1",
            selected === l.id && "bg-muted", l.hidden && "opacity-50")}>
          <span style={{ width: (l.depth ?? 0) * 12 }} aria-hidden className="shrink-0" />
          {l.children ? (
            <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <span aria-hidden className="w-3 shrink-0" />
          )}
          <button type="button"
            onClick={() => { if (!l.locked) onSelect(l.id); }}
            disabled={l.locked}
            aria-current={selected === l.id ? "true" : undefined}
            className={cn("min-w-0 flex-1 cursor-pointer truncate rounded px-1 py-0.5 text-left",
              l.locked && "cursor-default text-muted-foreground")}>
            {l.name}
          </button>
          {onToggleHidden ? (
            <button type="button" onClick={() => onToggleHidden(l.id)}
              aria-pressed={!l.hidden} aria-label={l.hidden ? `Show ${l.name}` : `Hide ${l.name}`}
              className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground">
              {l.hidden ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />}
            </button>
          ) : null}
          {onToggleLocked ? (
            <button type="button" onClick={() => onToggleLocked(l.id)}
              aria-pressed={!!l.locked} aria-label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}
              className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground">
              {l.locked ? <Lock aria-hidden className="size-3.5" /> : <Unlock aria-hidden className="size-3.5 opacity-40" />}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Editor tabs — closeable, scrollable, with a dirty marker.
 *
 * A DIRTY TAB SHOWS A DOT INSTEAD OF ITS CLOSE BUTTON until hovered. That is
 * the thing every editor does and the reason is good: the dot is the only
 * warning that closing loses work, and putting a close button where the warning
 * should be is how it gets lost.
 *
 * CLOSING SELECTS A NEIGHBOUR, the one to the right or else the left — never
 * "nothing". A pane that empties itself when you close the active tab makes
 * closing three files a trip back to the file list each time.
 *
 * The strip SCROLLS rather than shrinking tabs to nothing. Twenty tabs squeezed
 * into a row are twenty unreadable slivers; scrolled, they keep their names and
 * the active one is scrolled into view when it changes.
 *
 * Middle-click closes, because that is muscle memory from every browser and
 * editor, and it costs one line.
 */
export function PaneTabs({ tabs, active, onSelect, onClose, className }: {
  tabs: { key: string; label: string; dirty?: boolean }[];
  active: string;
  onSelect: (key: string) => void;
  onClose?: (key: string) => void;
  className?: string;
}) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  React.useEffect(() => {
    refs.current[active]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const close = (key: string) => {
    if (!onClose) return;
    // Pick the neighbour before closing, or the pane empties itself.
    if (key === active) {
      const i = tabs.findIndex((t) => t.key === key);
      const next = tabs[i + 1] ?? tabs[i - 1];
      if (next) onSelect(next.key);
    }
    onClose(key);
  };

  return (
    <div data-slot="pane-tabs" role="tablist" aria-label="Open tabs"
      className={cn("flex overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {tabs.map((t) => (
        <div key={t.key} className="group/tab relative flex shrink-0 items-center">
          <button
            ref={(el) => { refs.current[t.key] = el; }}
            role="tab"
            type="button"
            aria-selected={t.key === active}
            tabIndex={t.key === active ? 0 : -1}
            onClick={() => onSelect(t.key)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); close(t.key); } }}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.key === active);
              if (e.key === "ArrowRight") { e.preventDefault(); onSelect(tabs[(i + 1) % tabs.length].key); }
              if (e.key === "ArrowLeft") { e.preventDefault(); onSelect(tabs[(i - 1 + tabs.length) % tabs.length].key); }
            }}
            className={cn("cursor-pointer border-e border-border py-1.5 pe-7 ps-3 text-xs whitespace-nowrap",
              t.key === active ? "bg-background font-medium" : "bg-muted/40 text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            {t.dirty ? <span className="sr-only"> (unsaved)</span> : null}
          </button>
          {onClose ? (
            <span className="absolute end-1.5">
              {/* The dot occupies the close button's place until hovered — it is
                  the only warning that closing loses work. */}
              {t.dirty ? (
                <span aria-hidden className="block size-1.5 rounded-full bg-foreground group-hover/tab:hidden" />
              ) : null}
              <button type="button" onClick={() => close(t.key)} aria-label={`Close ${t.label}`}
                className={cn("cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                  t.dirty && "hidden group-hover/tab:block")}>
                <X aria-hidden className="size-3" />
              </button>
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

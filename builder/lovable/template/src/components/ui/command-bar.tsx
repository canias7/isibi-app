import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The Cmd+K palette — search everything, run anything.
 *
 * THE SHORTCUT IS SHOWN, and with the right key for the platform. A palette
 * nobody knows about is a palette nobody uses, and printing `Ctrl+K` to a Mac
 * user is worse than printing nothing.
 *
 * `preventDefault` on the shortcut, because Cmd+K is the browser's own search
 * bar focus in some builds and Ctrl+K is a link shortcut in others. Without it
 * the palette opens and the browser does something else at the same time.
 *
 * The list is filtered on the SUBTITLE and KEYWORDS as well as the label, so
 * "cancel" finds "Delete a booking" if that is what it is tagged with. A
 * palette that only matches visible text makes people guess the wording.
 *
 * Arrow keys move a highlighted index that is CLAMPED and RESET when the query
 * changes — an index left pointing at row 7 of a list that now has two rows
 * runs the wrong command on Enter, which in a palette is how somebody deletes
 * something.
 */
export type Command = {
  key: string;
  label: string;
  hint?: string;
  keywords?: string[];
  group?: string;
  onRun: () => void;
};

export function useCommandShortcut(onOpen: () => void) {
  const openRef = React.useRef(onOpen);
  openRef.current = onOpen;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      // Or the browser acts on it too.
      e.preventDefault();
      openRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

export function shortcutLabel() {
  const mac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  return mac ? "⌘K" : "Ctrl K";
}

export function CommandBar({ commands, query, onQueryChange, onClose, placeholder = "Search or run a command", className }: {
  commands: Command[];
  query: string;
  onQueryChange: (q: string) => void;
  onClose?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const [at, setAt] = React.useState(0);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = commands.filter((c) => {
    if (!words.length) return true;
    const hay = [c.label, c.hint ?? "", c.group ?? "", ...(c.keywords ?? [])].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });

  // Reset when the list changes, or Enter runs the wrong command.
  React.useEffect(() => { setAt(0); }, [query]);
  const index = Math.min(at, Math.max(0, shown.length - 1));

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setAt((n) => Math.min(shown.length - 1, n + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setAt((n) => Math.max(0, n - 1)); }
            if (e.key === "Enter") { e.preventDefault(); shown[index]?.onRun(); onClose?.(); }
            if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
          }}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
      </div>
      <ul className="max-h-72 overflow-y-auto p-1">
        {shown.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;.</li>
        ) : shown.map((c, i) => (
          <li key={c.key}>
            <button type="button"
              onMouseEnter={() => setAt(i)}
              onClick={() => { c.onRun(); onClose?.(); }}
              aria-current={i === index ? "true" : undefined}
              className={cn("flex w-full cursor-pointer items-baseline gap-2 rounded px-2 py-1.5 text-start text-sm",
                i === index && "bg-muted")}>
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              {c.hint ? <span className="shrink-0 text-xs text-muted-foreground">{c.hint}</span> : null}
              {c.group ? <span className="shrink-0 text-[10px] text-muted-foreground">{c.group}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

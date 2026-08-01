import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Who is reading — and the page changes underneath.
 *
 * The institutional shape: "For patients / For clinicians", "Personal /
 * Business", "I'm hiring / I'm looking". One organisation talking to two
 * audiences who need different words for the same service, and a marketplace
 * has that problem from both ends at once.
 *
 * The choice is REMEMBERED, for the reason `sdk-tabs` remembers a language: an
 * audience switch is a statement about who you are, and being asked again on
 * the next page reads as not having been listened to. `localStorage`, wrapped
 * in try/catch because it throws outright in a Safari private window.
 *
 * Real tabs — one tab stop, arrow keys, `aria-selected` — not a row of buttons,
 * because moving between two audiences with the keyboard is a normal thing to
 * do here.
 *
 * The current audience is also stated in a `role="status"` line. The visible
 * effect of this control is the rest of the page rewriting itself, and a screen
 * reader gets no notice of that whatsoever unless something says so. The line
 * is `sr-only` by default since sighted readers can see the selected tab.
 *
 * It does NOT own the content. Pass `value`/`onChange` to drive it from a
 * route, or let it keep its own and read the choice back with `useAudience`.
 */
const KEY = "audience";

export function useAudience(fallback: string, storageKey: string = KEY) {
  const [who, setWho] = React.useState(fallback);
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setWho(saved);
    } catch { /* private mode */ }
  }, [storageKey]);
  const set = React.useCallback((next: string) => {
    setWho(next);
    try { localStorage.setItem(storageKey, next); } catch { /* as above */ }
  }, [storageKey]);
  return [who, set] as const;
}

export function AudienceSwitch({
  audiences, value, onChange, storageKey = KEY, label = "I am", showStatus, className,
}: {
  audiences: { key: string; label: string; description?: string }[];
  value?: string;
  onChange?: (key: string) => void;
  storageKey?: string;
  label?: string;
  /** Show the "Showing…" line to everyone. Off by default — it is announced either way. */
  showStatus?: boolean;
  className?: string;
}) {
  const [own, setOwn] = useAudience(audiences[0]?.key ?? "", storageKey);
  const active = value ?? (audiences.some((a) => a.key === own) ? own : audiences[0]?.key);
  const pick = onChange ?? setOwn;
  const current = audiences.find((a) => a.key === active);

  if (!current) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
        <div role="tablist" aria-label={label}
          onKeyDown={(e) => {
            const i = audiences.findIndex((a) => a.key === active);
            if (e.key === "ArrowRight") { e.preventDefault(); pick(audiences[(i + 1) % audiences.length].key); }
            if (e.key === "ArrowLeft") { e.preventDefault(); pick(audiences[(i - 1 + audiences.length) % audiences.length].key); }
          }}
          className="inline-flex gap-1 rounded-md border border-border bg-muted p-1">
          {audiences.map((a) => (
            <button key={a.key} role="tab" type="button"
              aria-selected={a.key === active}
              tabIndex={a.key === active ? 0 : -1}
              onClick={() => pick(a.key)}
              className={cn("cursor-pointer rounded px-3 py-1 text-sm",
                a.key === active ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <p role="status" className={cn("text-sm text-muted-foreground", !showStatus && "sr-only")}>
        Showing {current.label}
        {current.description ? ` — ${current.description}` : ""}
      </p>
    </div>
  );
}

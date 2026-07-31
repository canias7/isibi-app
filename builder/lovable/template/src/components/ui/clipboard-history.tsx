import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A history of what THIS APP copied — never a reader of the system
 * clipboard.
 *
 * IT RECORDS ONLY COPIES MADE THROUGH ITS OWN `copy()`. Reading
 * `navigator.clipboard.readText()` needs a permission prompt and hands
 * the app whatever the person copied in their password manager thirty
 * seconds ago — a privacy hole wearing a convenience. Recording our own
 * copies needs no permission and can contain no surprises.
 *
 * MEMORY ONLY, DELIBERATELY NOT PERSISTED — the one stored-preference
 * exception in this kit. Copied text is exactly the category that
 * contains codes, addresses and keys; localStorage would keep them past
 * the session on a shared machine.
 *
 * Duplicates move to the front rather than repeating: re-copying the same
 * address five times is one remembered thing, not five rows.
 */
export function useClipboardHistory(max = 8) {
  const [history, setHistory] = React.useState<{ text: string; label?: string }[]>([]);
  const copy = React.useCallback(async (text: string, label?: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* nothing more to try */ }
      ta.remove();
    }
    setHistory((h) => [{ text, label }, ...h.filter((x) => x.text !== text)].slice(0, max));
  }, [max]);
  return { copy, history, clear: () => setHistory([]) };
}

export function ClipboardHistory({ history, onCopy, onClear, className }: {
  history: { text: string; label?: string }[];
  onCopy: (text: string) => void;
  onClear?: () => void;
  className?: string;
}) {
  if (!history.length) return null;
  return (
    <div className={cn("rounded-lg border border-border", className)}>
      <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Copied this session</p>
        {onClear ? (
          <button type="button" onClick={onClear}
            className="cursor-pointer text-[11px] text-muted-foreground underline underline-offset-2">
            Clear
          </button>
        ) : null}
      </div>
      <ul className="divide-y divide-border">
        {history.map((h) => (
          <li key={h.text}>
            <button type="button" onClick={() => onCopy(h.text)}
              className="flex w-full cursor-pointer items-baseline justify-between gap-3 px-2.5 py-1.5 text-left hover:bg-muted">
              <span className="min-w-0 truncate font-mono text-xs">{h.text}</span>
              {h.label ? <span className="shrink-0 text-[11px] text-muted-foreground">{h.label}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

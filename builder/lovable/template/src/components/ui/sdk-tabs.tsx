import * as React from "react";
import { cn } from "@/lib/utils";
import { SyntaxHighlight } from "@/components/ui/syntax-highlight";
/**
 * The same request in several languages.
 *
 * The choice is REMEMBERED and applies to every one of these on the page.
 * Documentation has twenty of these blocks; picking Python at the top and
 * finding JavaScript again at every subsequent example is the single most
 * irritating thing about API docs, and it is one shared piece of state.
 *
 * It persists across page loads too, in `localStorage`, wrapped in a try/catch
 * because it throws outright in a Safari private window.
 *
 * Real tabs — `role="tablist"`, one tab stop, arrow keys, `aria-controls` — not
 * a row of buttons. A reader moving between four languages with the keyboard is
 * a normal thing to do here.
 *
 * The panel keeps a MINIMUM HEIGHT across languages, because the examples are
 * different lengths and switching tabs otherwise jumps the whole page under the
 * reader's cursor.
 */
const KEY = "sdk-language";

export function useSdkLanguage(fallback: string) {
  const [lang, setLang] = React.useState(fallback);
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setLang(saved);
    } catch { /* private mode */ }
  }, []);
  const set = React.useCallback((next: string) => {
    setLang(next);
    try { localStorage.setItem(KEY, next); } catch { /* as above */ }
  }, []);
  return [lang, set] as const;
}

export function SdkTabs({ samples, value, onChange, className }: {
  samples: { key: string; label: string; lang?: string; code: string }[];
  value?: string;
  onChange?: (key: string) => void;
  className?: string;
}) {
  const [own, setOwn] = useSdkLanguage(samples[0]?.key ?? "");
  const active = value ?? (samples.some((s) => s.key === own) ? own : samples[0]?.key);
  const pick = onChange ?? setOwn;
  const id = React.useId();
  const current = samples.find((s) => s.key === active) ?? samples[0];
  const tallest = Math.max(...samples.map((s) => s.code.split("\n").length), 1);

  if (!current) return null;
  return (
    <div data-slot="sdk-tabs" className={cn("overflow-hidden rounded-md border border-border", className)}>
      <div role="tablist" aria-label="Language"
        onKeyDown={(e) => {
          const i = samples.findIndex((s) => s.key === active);
          if (e.key === "ArrowRight") { e.preventDefault(); pick(samples[(i + 1) % samples.length].key); }
          if (e.key === "ArrowLeft") { e.preventDefault(); pick(samples[(i - 1 + samples.length) % samples.length].key); }
        }}
        className="flex gap-1 border-b border-border bg-muted px-1 pt-1">
        {samples.map((s) => (
          <button key={s.key} role="tab" type="button"
            aria-selected={s.key === active}
            aria-controls={`${id}-panel`}
            tabIndex={s.key === active ? 0 : -1}
            onClick={() => pick(s.key)}
            className={cn("cursor-pointer rounded-t px-2.5 py-1 text-xs",
              s.key === active ? "bg-background font-medium" : "text-muted-foreground hover:text-foreground")}>
            {s.label}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel"
        style={{ minHeight: `${tallest * 1.5 + 1}rem` }}
        className="overflow-x-auto px-3 py-2">
        <SyntaxHighlight code={current.code} lang={current.lang ?? current.key} />
      </div>
    </div>
  );
}

import * as React from "react";
import { ShortcutKeys } from "@/components/ui/shortcut-overlay";
import { cn } from "@/lib/utils";
/**
 * "g then b" — two-stroke shortcuts, and the hook that listens for them.
 *
 * THE SEQUENCE TIMES OUT (1s between strokes). Without a timeout, a "g"
 * typed an hour ago arms "b" forever, and pressing b in some later
 * context fires navigation nobody asked for — the stale-prefix bug every
 * gmail-style implementation hits once.
 *
 * TYPING CONTEXTS ARE IGNORED (input, textarea, select, contenteditable
 * — the shortcut-overlay guard, same list): sequences are unmodified
 * letters, which is exactly what typing is made of.
 *
 * The visual half renders "g then b" with real kbd glyphs — the word
 * "then" spelled out, because "g b" reads as one chord and the entire
 * point is that it is not.
 */
export function useKeySequence(sequence: string, onFire: () => void, timeoutMs = 1000) {
  const progress = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = React.useRef(onFire);
  cb.current = onFire;

  React.useEffect(() => {
    const keys = sequence.toLowerCase().split(/\s+/).filter(Boolean);
    const reset = () => { progress.current = 0; if (timer.current) clearTimeout(timer.current); };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) { reset(); return; }
      const t = e.target as HTMLElement;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) { reset(); return; }
      if (e.key.toLowerCase() === keys[progress.current]) {
        progress.current += 1;
        if (timer.current) clearTimeout(timer.current);
        if (progress.current >= keys.length) { reset(); cb.current(); return; }
        timer.current = setTimeout(reset, timeoutMs);
      } else {
        reset();
        // A wrong key can still be the START of the sequence.
        if (e.key.toLowerCase() === keys[0]) {
          progress.current = 1;
          timer.current = setTimeout(reset, timeoutMs);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); reset(); };
  }, [sequence, timeoutMs]);
}

export function KeySequence({ sequence, className }: { sequence: string; className?: string }) {
  const keys = sequence.split(/\s+/).filter(Boolean);
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <span className="text-[10px] text-muted-foreground">then</span> : null}
          <ShortcutKeys keys={[k]} />
        </React.Fragment>
      ))}
    </span>
  );
}

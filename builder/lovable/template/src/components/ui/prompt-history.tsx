import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Up-arrow through the things you have already asked, like a shell.
 *
 * The arrow only recalls when the caret is at the START of the box — otherwise
 * Up is how somebody moves through the multi-line prompt they are writing, and
 * hijacking it destroys the text they were editing. The same for Down at the
 * end. This is the whole reason the hook is more than an array.
 *
 * The DRAFT is preserved. Arrowing up from a half-written prompt and back down
 * restores it, because the alternative — losing what you were typing by
 * pressing a key that looks like navigation — is the failure that makes people
 * stop using the feature.
 *
 * Consecutive DUPLICATES are dropped on the way in. Pressing send twice on the
 * same prompt should not mean pressing Up twice to get past it.
 *
 * The list is capped, oldest dropped. Unbounded, it is a session-long log of
 * everything typed, held in memory and — if the caller persists it — on disk.
 */
export function usePromptHistory(max = 50) {
  const [items, setItems] = React.useState<string[]>([]);
  const [at, setAt] = React.useState<number | null>(null);
  const draft = React.useRef("");

  const push = React.useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setItems((xs) => (xs[xs.length - 1] === t ? xs : [...xs, t].slice(-max)));
    setAt(null);
  }, [max]);

  const onKeyDown = React.useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    value: string,
    setValue: (next: string) => void,
  ) => {
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (items.length === 0 || start !== end) return;

    if (e.key === "ArrowUp" && start === 0) {
      e.preventDefault();
      if (at == null) draft.current = value;
      const next = at == null ? items.length - 1 : Math.max(0, at - 1);
      setAt(next);
      setValue(items[next]);
    } else if (e.key === "ArrowDown" && start === value.length) {
      if (at == null) return;
      e.preventDefault();
      if (at >= items.length - 1) { setAt(null); setValue(draft.current); }
      else { setAt(at + 1); setValue(items[at + 1]); }
    }
  }, [items, at]);

  return { items, push, onKeyDown, position: at };
}

export function PromptHistory({ items, onPick, title = "Recent", max = 5, className }: {
  items: string[];
  onPick: (text: string) => void;
  title?: React.ReactNode;
  max?: number;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.slice(-max).reverse().map((t, i) => (
          <li key={t + i}>
            <button type="button" onClick={() => onPick(t)}
              className="w-full cursor-pointer truncate rounded px-2 py-1 text-left text-xs hover:bg-muted">
              {t}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

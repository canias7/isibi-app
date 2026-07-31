import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The text box you type a prompt into.
 *
 * ENTER SENDS and Shift+Enter makes a new line, which is the convention every
 * chat product now shares — but the important half is the IME check. While
 * somebody is composing Japanese, Chinese or Korean text, Enter confirms the
 * candidate word, and a handler that sends on it cuts their sentence off
 * mid-word, every time. `e.nativeEvent.isComposing` is the guard, and its
 * absence is why so many chat boxes are unusable in those languages.
 *
 * It GROWS with the text up to a cap and then scrolls. A one-line box for a
 * paragraph-long instruction means editing through a letterbox; an
 * unbounded one pushes the send button off the screen.
 *
 * The height is reset to `auto` before being measured, or `scrollHeight` only
 * ever reports the larger of the old and new heights and the box can grow but
 * never shrink.
 *
 * While a response is streaming the button becomes STOP rather than being
 * disabled — the most likely reason somebody reaches for it mid-answer is to
 * call the answer off.
 */
export function PromptBox({
  value, onChange, onSubmit, onStop, busy, placeholder = "Ask anything", maxRows = 10,
  attachments, footer, autoFocus, className,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  busy?: boolean;
  placeholder?: string;
  maxRows?: number;
  attachments?: React.ReactNode;
  footer?: React.ReactNode;
  autoFocus?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = `${Math.min(el.scrollHeight, line * maxRows)}px`;
  }, [value, maxRows]);

  const send = () => { if (value.trim() && !busy) onSubmit(); };

  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl border border-border bg-background p-2 focus-within:border-ring", className)}>
      {attachments}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            // Enter confirms a candidate word while an IME is composing.
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            send();
          }}
          className="max-h-80 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        {busy && onStop ? (
          <button type="button" onClick={onStop} aria-label="Stop generating"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-foreground text-background hover:opacity-90">
            <span aria-hidden className="size-2.5 rounded-xs bg-background" />
          </button>
        ) : (
          <button type="button" onClick={send} disabled={!value.trim() || busy} aria-label="Send"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-foreground text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-30">
            <ArrowUp aria-hidden className="size-4" />
          </button>
        )}
      </div>
      {footer ? <div className="px-2 pb-0.5 text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

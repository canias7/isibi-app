import * as React from "react";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The box you type into.
 *
 * It grows with the message up to a cap and then scrolls — a fixed one-line
 * input makes anything longer than a sentence unreviewable before sending.
 * Enter sends, Shift+Enter is a newline, which is what people expect from a
 * chat box and the opposite of what they expect from a form.
 */
export function ChatComposer({ onSend, busy, placeholder = "Write a message…", maxRows = 6, className }: {
  onSend: (body: string) => void; busy?: boolean;
  placeholder?: string; maxRows?: number; className?: string;
}) {
  const [body, setBody] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxRows * 24 + 16) + "px";
  };
  const send = () => {
    const t = body.trim();
    if (!t || busy) return;
    onSend(t);
    setBody("");
    requestAnimationFrame(grow);
  };
  return (
    <div data-slot="chat-composer" className={cn("flex items-end gap-2 border-t border-border p-2", className)}>
      <textarea ref={ref} rows={1} value={body} placeholder={placeholder} aria-label="Message"
        className="max-h-40 flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onChange={(e) => { setBody(e.target.value); grow(); }}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
      <Button size="icon" onClick={send} disabled={busy || !body.trim()} aria-label="Send">
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  );
}

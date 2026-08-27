import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The scrolling body of a conversation.
 *
 * It sticks to the bottom only when the reader is ALREADY near the bottom.
 * Scrolling unconditionally on every new message yanks somebody out of the
 * history they were reading, which is the single most complained-about
 * behaviour in every chat UI that gets it wrong.
 */
export function ChatThread({ children, className }: { children?: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const stick = React.useRef(true);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stick.current) el.scrollTop = el.scrollHeight;
  });
  return (
    <div data-slot="chat-thread" ref={ref} className={cn("flex flex-col gap-3 overflow-y-auto p-3", className)}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}>
      {children}
    </div>
  );
}

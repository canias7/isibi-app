import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { TextareaCount } from "@/components/ui/textarea-count";
import { cn } from "@/lib/utils";
/**
 * Write a reply.
 *
 * Cmd/Ctrl+Enter submits, because that is what anyone typing in a box expects —
 * and plain Enter still makes a new line, which is what a comment needs.
 */
export function ReplyBox({ onSubmit, busy, placeholder = "Write a reply…", max = 1000, className }: {
  onSubmit: (body: string) => void; busy?: boolean;
  placeholder?: string; max?: number; className?: string;
}) {
  const [body, setBody] = React.useState("");
  const send = () => { if (body.trim()) { onSubmit(body.trim()); setBody(""); } };
  return (
    <div className={cn("flex flex-col gap-2", className)}
      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); send(); } }}>
      <TextareaCount value={body} onChange={setBody} max={max} rows={3} placeholder={placeholder} />
      <BusyButton size="sm" busy={busy} busyLabel="Posting…" disabled={!body.trim()}
        onClick={send} className="w-fit">Reply</BusyButton>
    </div>
  );
}

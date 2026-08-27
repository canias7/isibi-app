import * as React from "react";
import { ChevronRight, Check, X, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Searched the web for barber shops in Liverpool" — one step the model took,
 * collapsed by default.
 *
 * COLLAPSED, because the arguments and the result are usually a wall of JSON
 * and the answer is what somebody came for. Expanded is for the moment they
 * doubt the answer, which is exactly when the raw call is the most useful thing
 * on the page — so it is one press away and never hidden entirely.
 *
 * The summary is a SENTENCE the caller supplies, not the function name. `WebS`
 * `earch({"query":"…"})` is a stack frame; "Searched the web for X" is what
 * happened.
 *
 * A FAILED call is shown, not swallowed. A model that tried to look something
 * up, failed, and answered from memory has produced a different kind of answer,
 * and hiding the failure hides why.
 *
 * The status is an icon AND a word in `sr-only` text, because running, done and
 * failed differ here by glyph — three shapes, not three colours.
 */
export function ToolCallCard({
  title, status = "done", input, output, error, defaultOpen, duration, className,
}: {
  title: React.ReactNode;
  status?: "running" | "done" | "failed";
  input?: React.ReactNode;
  output?: React.ReactNode;
  error?: React.ReactNode;
  defaultOpen?: boolean;
  duration?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const Icon = status === "running" ? Loader : status === "failed" ? X : Check;
  const word = status === "running" ? "running" : status === "failed" ? "failed" : "finished";

  return (
    <div data-slot="tool-call-card" className={cn("rounded-lg border border-border text-sm", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-start hover:bg-muted/60">
        <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <Icon aria-hidden className={cn("size-3.5 shrink-0",
          status === "running" && "motion-safe:animate-spin",
          status !== "failed" && "text-muted-foreground")} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="sr-only">— {word}</span>
        {duration ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{duration}</span> : null}
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {input ? (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Sent</p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{input}</pre>
            </div>
          ) : null}
          {error ? (
            <div>
              <p className="mb-1 text-xs font-medium">Failed</p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{error}</pre>
            </div>
          ) : output ? (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Came back</p>
              <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{output}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

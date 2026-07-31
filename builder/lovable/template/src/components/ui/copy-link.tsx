import * as React from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The URL beside a copy button.
 *
 * THE URL IS SELECTABLE TEXT, not only a button. Somebody who wants half of it,
 * or who wants to read it before trusting it, cannot do either with a button
 * that copies invisibly — and reading a share link before sending it is a
 * reasonable thing to do.
 *
 * It falls back through `execCommand` and then states a failure, because
 * `navigator.clipboard` rejects on an insecure origin and in a sandboxed frame.
 * A copy button that silently does nothing is worse than none: the person walks
 * away believing they have the link. Shared with `copy-response`.
 *
 * The confirmation is ON the button and announced, for about two seconds. A
 * toast for a copy is an interruption for the least surprising thing a button
 * can do.
 *
 * A long URL truncates from the MIDDLE, keeping the domain and the identifier —
 * a trailing ellipsis on a share link leaves several that read identically.
 */
export function CopyLink({ url, label, truncate = true, className }: {
  url: string;
  label?: React.ReactNode;
  truncate?: boolean;
  className?: string;
}) {
  const [state, setState] = React.useState<"idle" | "done" | "failed">("idle");

  React.useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("done");
      return;
    } catch { /* insecure origin, sandboxed frame, or a refused permission */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      setState(ok ? "done" : "failed");
    } catch { setState("failed"); }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? <p className="text-xs font-medium">{label}</p> : null}
      <div className="flex items-center gap-2 rounded-md border border-border p-1 pl-2.5">
        <Link2 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        {/* Selectable, so it can be read and partly copied by hand. */}
        <span className={cn("min-w-0 flex-1 font-mono text-xs select-all", truncate && "truncate")}>{url}</span>
        <button type="button" onClick={copy}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs font-medium hover:bg-muted">
          {state === "done" ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
          {state === "done" ? "Copied" : "Copy"}
        </button>
      </div>
      <p aria-live="polite" className={cn("text-xs", state === "failed" ? "font-medium" : "sr-only")}>
        {state === "done" ? "Copied to the clipboard"
          : state === "failed" ? "Could not copy — select the link and copy it yourself."
          : ""}
      </p>
    </div>
  );
}

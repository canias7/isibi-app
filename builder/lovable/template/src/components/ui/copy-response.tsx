import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Copy an answer to the clipboard.
 *
 * `navigator.clipboard` REJECTS on an insecure origin, in a sandboxed frame,
 * and when the page has lost focus — so there is a fallback and, if that fails
 * too, a stated failure. A copy button that silently does nothing is worse than
 * no copy button, because the person walks away believing they have the text.
 *
 * The confirmation is on the button ITSELF and lasts about two seconds. A toast
 * for a copy is an interruption for the least surprising thing a button can do,
 * and it usually appears in the opposite corner from where the eye is.
 *
 * `aria-live` announces it, because the visual change is the only feedback and
 * a listener would otherwise get none at all.
 *
 * Both plain text and rich HTML are written when `html` is given, so a paste
 * into a document keeps its headings and a paste into a code editor does not
 * arrive full of markup.
 */
export function copyText(text: string, html?: string): Promise<boolean> {
  const rich = async () => {
    if (!html || typeof ClipboardItem === "undefined") throw new Error("no rich clipboard");
    await navigator.clipboard.write([new ClipboardItem({
      "text/plain": new Blob([text], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    })]);
  };
  const plain = () => navigator.clipboard.writeText(text);
  const legacy = () => {
    // execCommand is deprecated and is the only thing that works on an insecure
    // origin, which is where a lot of previews and embeds run.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("copy refused");
  };
  return rich().catch(plain).catch(() => legacy()).then(() => true).catch(() => false);
}

export function CopyResponse({ text, html, label = "Copy", showLabel, className }: {
  text: string;
  html?: string;
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const [state, setState] = React.useState<"idle" | "done" | "failed">("idle");
  React.useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={async () => setState((await copyText(text, html)) ? "done" : "failed")}
        aria-label={label}
        className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
          showLabel ? "" : "")}
      >
        {state === "done" ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
        {showLabel ? (state === "done" ? "Copied" : label) : null}
      </button>
      <span aria-live="polite" className={cn("text-xs", state === "failed" ? "font-medium" : "sr-only")}>
        {state === "done" ? "Copied to the clipboard" : state === "failed" ? "Could not copy — select the text and copy it yourself." : ""}
      </span>
    </span>
  );
}

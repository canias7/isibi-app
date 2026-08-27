import { useState } from "react";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A copyable link straight to one comment.
 *
 * IT COPIES AN ABSOLUTE URL, which is the whole job. A comment anchor is nearly
 * always shared by pasting into a message to somebody else, and a relative
 * `#c-42` is useless the moment it leaves the page. The origin is read at click
 * time rather than at render, so it is right on any host.
 *
 * IT FALLS BACK TO A VISIBLE FIELD WHEN COPYING IS REFUSED. `navigator.clipboard`
 * needs a secure context and a gesture, so a copy button that silently fails is
 * the norm on plain HTTP — the same failure `clipboard-blocked` exists for, and
 * this reuses that answer rather than pretending it worked.
 *
 * "COPIED" IS ANNOUNCED, not just shown. A visual flash on a button is invisible
 * to a screen reader, so the confirmation goes in a `role="status"`.
 *
 * IT IS ALSO A REAL `<a href>`, so middle-click, right-click-copy and opening in
 * a new tab all behave — a button-only permalink breaks every one of those.
 */
export function CommentPermalink({ anchor, label = "Link to this comment", className }: {
  /** The fragment id — "c-42". */
  anchor: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");
  const href = `#${anchor}`;
  return (
    <span data-slot="comment-permalink" className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <a href={href} aria-label={label}
        onClick={(e) => {
          const full = `${window.location.origin}${window.location.pathname}${window.location.search}#${anchor}`;
          setUrl(full);
          if (!navigator.clipboard?.writeText) { setState("manual"); return; }
          e.preventDefault();
          navigator.clipboard.writeText(full)
            .then(() => setState("copied"))
            .catch(() => setState("manual"));
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        <Link2 className="size-3" aria-hidden="true" />
        Link
      </a>
      {state === "copied" && <span role="status" className="text-xs text-muted-foreground">Copied</span>}
      {state === "manual" && (
        <input readOnly value={url} aria-label="Link to copy" onFocus={(e) => e.currentTarget.select()}
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 font-mono text-xs" />
      )}
    </span>
  );
}

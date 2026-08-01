import * as React from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
/**
 * The code to paste this into someone else's page.
 *
 * THE SNIPPET IS SELECTABLE AND COPYABLE IN ONE PRESS, because it is going into
 * a text editor and hand-transcription of an iframe tag is nobody's idea of a
 * good time.
 *
 * IT SAYS WHAT THE EMBED WILL SHOW to a visitor who is not signed in. An embed
 * that renders a sign-in prompt on somebody else's site is the failure this
 * warns about, and it is invisible until the page is published.
 *
 * SIZE IS PART OF THE SNIPPET AND ADJUSTABLE. A fixed height is the commonest
 * reason an embed looks broken on the host page, and offering it here is
 * cheaper than a support thread.
 */
export function EmbedSnippet({ src, width = "100%", height = 480, title, publicNote, className }: {
  src: string;
  width?: string | number;
  height?: number;
  /** The iframe title — required for the host page's accessibility. */
  title: string;
  /** What a signed-out visitor sees. */
  publicNote?: string;
  className?: string;
}) {
  const [h, setH] = React.useState(height);
  const id = React.useId();
  const code = `<iframe src="${src}" title="${title}" width="${width}" height="${h}" style="border:0" loading="lazy"></iframe>`;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-xs text-muted-foreground">Height</label>
        <input id={id} type="number" inputMode="numeric" min={120} step={20} value={h}
          onChange={(e) => setH(Math.max(Number(e.target.value) || 120, 120))}
          className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      </div>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs whitespace-pre select-all">
          {code}
        </code>
        <CopyButton value={code} label="Copy embed code" />
      </div>
      {publicNote && <p className="text-xs text-muted-foreground">{publicNote}</p>}
    </div>
  );
}

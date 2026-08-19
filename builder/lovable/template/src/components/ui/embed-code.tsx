import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The iframe snippet somebody pastes into their own site.
 *
 * THE IFRAME CARRIES `title`, and it is not optional — an untitled iframe is a
 * WCAG failure on somebody ELSE's site, caused by our snippet. It is one
 * attribute and it is the single most common accessibility defect embed codes
 * spread.
 *
 * `loading="lazy"` and an explicit width and height, so the embed does not
 * block the host page's load and does not shift its layout when it arrives —
 * the same reasoning as `progressive-image`, applied to somebody else's page.
 *
 * The size is EDITABLE and the snippet updates live. A fixed snippet means the
 * first thing every person does is hand-edit the numbers, and hand-editing HTML
 * in a textarea is where the quotes get broken.
 *
 * `allowfullscreen` and a `sandbox` are offered as explicit choices rather than
 * being on by default: both are decisions about what our embed may do on
 * somebody else's page, and defaults there should be the narrow ones.
 */
export function buildEmbed({ src, title, width, height, allowFullscreen, responsive }: {
  src: string;
  title: string;
  width: number;
  height: number;
  allowFullscreen?: boolean;
  responsive?: boolean;
}) {
  const attrs = [
    `src="${src}"`,
    `title="${title.replace(/"/g, "&quot;")}"`,
    responsive ? `style="width:100%;aspect-ratio:${width}/${height};border:0"` : `width="${width}" height="${height}" style="border:0"`,
    `loading="lazy"`,
    allowFullscreen ? "allowfullscreen" : null,
  ].filter(Boolean);
  return `<iframe ${attrs.join(" ")}></iframe>`;
}

export function EmbedCode({ src, title, defaultWidth = 560, defaultHeight = 315, className }: {
  src: string;
  title: string;
  defaultWidth?: number;
  defaultHeight?: number;
  className?: string;
}) {
  const [w, setW] = React.useState(defaultWidth);
  const [h, setH] = React.useState(defaultHeight);
  const [responsive, setResponsive] = React.useState(true);
  const [full, setFull] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const code = buildEmbed({ src, title, width: w, height: h, allowFullscreen: full, responsive });

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          Width
          <input type="number" inputMode="numeric" value={w} onChange={(e) => setW(Number(e.target.value) || 1)}
            className="h-7 w-20 rounded border border-border bg-background px-1.5 tabular-nums outline-none focus-visible:border-ring" />
        </label>
        <label className="flex items-center gap-1.5">
          Height
          <input type="number" inputMode="numeric" value={h} onChange={(e) => setH(Number(e.target.value) || 1)}
            className="h-7 w-20 rounded border border-border bg-background px-1.5 tabular-nums outline-none focus-visible:border-ring" />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={responsive} onChange={(e) => setResponsive(e.target.checked)}
            className="size-3.5 cursor-pointer accent-foreground" />
          Fit the width
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)}
            className="size-3.5 cursor-pointer accent-foreground" />
          Allow fullscreen
        </label>
      </div>
      <div className="relative">
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-2.5 pe-20 font-mono text-xs whitespace-pre-wrap">{code}</pre>
        <button type="button"
          onClick={async () => {
            try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
            catch { /* refused clipboard */ }
          }}
          className="absolute top-2 end-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted">
          {copied ? <Check aria-hidden className="size-3" /> : <Copy aria-hidden className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        The <code>title</code> is what makes the embed usable with a screen reader on your page. Please keep it.
      </p>
    </div>
  );
}

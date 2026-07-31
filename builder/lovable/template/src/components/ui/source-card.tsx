import * as React from "react";
import { FileText, Globe, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One source, as a card — for a row of them above an answer.
 *
 * The FAVICON comes from the page's own origin, and it fails silently to a
 * generic glyph. A broken-image icon in a row of six sources looks like the
 * answer is malfunctioning, and a favicon is decoration: it must never be a
 * reason the row looks wrong.
 *
 * Worth stating plainly: fetching it is a request to that origin from the
 * reader's browser. For a citation card that is unavoidable — the link is
 * there to be followed — but it is a real third-party request and `icon={false}`
 * turns it off for anything privacy-sensitive.
 *
 * An UPLOADED file and a web page look different, because "the model read your
 * contract" and "the model read a blog post" are very different claims and a
 * uniform row of cards flattens them.
 *
 * The whole card is one link with a `line-clamp`, so a long title cannot push
 * the row of cards to different heights — a ragged row is what makes six
 * sources look like a mistake rather than a list.
 */
export function SourceCard({ url, title, source, kind = "web", icon = true, className }: {
  url?: string;
  title: React.ReactNode;
  source?: React.ReactNode;
  kind?: "web" | "file";
  icon?: boolean;
  className?: string;
}) {
  const [badIcon, setBadIcon] = React.useState(false);
  let origin = "";
  try { origin = url ? new URL(url).origin : ""; } catch { origin = ""; }
  const host = origin ? origin.replace(/^https?:\/\/(www\.)?/, "") : null;

  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {kind === "file" ? (
          <FileText aria-hidden className="size-3 shrink-0" />
        ) : icon && origin && !badIcon ? (
          <img src={`${origin}/favicon.ico`} alt="" width={12} height={12}
            onError={() => setBadIcon(true)} className="size-3 shrink-0 rounded-xs" />
        ) : (
          <Globe aria-hidden className="size-3 shrink-0" />
        )}
        <span className="truncate">{source ?? host ?? "Source"}</span>
        {url ? <ExternalLink aria-hidden className="size-2.5 shrink-0" /> : null}
      </span>
      <span className="line-clamp-2 text-xs leading-snug font-medium">{title}</span>
    </>
  );

  const shared = cn("flex h-full min-w-40 flex-col gap-1.5 rounded-lg border border-border p-2.5", className);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={cn(shared, "hover:bg-muted")}>
      {inner}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  ) : (
    <div className={shared}>{inner}</div>
  );
}

import * as React from "react";
import { Download, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
/**
 * "Download" with a choice of format.
 *
 * EACH FORMAT SAYS WHAT IT IS FOR, not just its extension. "CSV" and "XLSX"
 * mean nothing to most people; "CSV — opens in any spreadsheet" and "PDF — for
 * printing or emailing" is the decision they are actually making.
 *
 * THE SIZE IS SHOWN WHEN KNOWN. A 40 MB download on a phone on mobile data is
 * a different proposition from a 12 KB one, and the number is the only thing
 * that says which this is.
 *
 * The MOST COMMON format is the direct button and the rest are behind the
 * chevron — the same split as `regenerate-button`. A menu for a choice that is
 * the same 90% of the time is a press people resent.
 *
 * `download` on the anchor, with a filename. Without it a text-ish response
 * opens in the tab instead of saving, and the person loses the page they were
 * on.
 */
export function DownloadMenu({ formats, onDownload, label = "Download", className }: {
  formats: { key: string; label: string; hint?: React.ReactNode; size?: React.ReactNode; href?: string; filename?: string }[];
  onDownload?: (key: string) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [first, ...rest] = formats;
  if (!first) return null;

  const row = (f: (typeof formats)[number], primary?: boolean) => {
    const body = (
      <>
        <span className="min-w-0 flex-1">
          <span className={cn("block", primary ? "" : "font-medium")}>{f.label}</span>
          {f.hint && !primary ? <span className="block text-xs text-muted-foreground">{f.hint}</span> : null}
        </span>
        {f.size ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{f.size}</span> : null}
      </>
    );
    const cls = primary
      ? "inline-flex cursor-pointer items-center gap-1.5 rounded-s-md px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
      : "flex w-full cursor-pointer items-baseline gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-muted";
    return f.href ? (
      <a href={f.href} download={f.filename ?? true} onClick={() => setOpen(false)} className={cls}>
        {primary ? <Download aria-hidden className="size-3.5" /> : null}
        {body}
      </a>
    ) : (
      <button type="button" onClick={() => { setOpen(false); onDownload?.(f.key); }} className={cls}>
        {primary ? <Download aria-hidden className="size-3.5" /> : null}
        {body}
      </button>
    );
  };

  return (
    <span data-slot="download-menu" className={cn("inline-flex items-center rounded-md border border-border", className)}>
      {row({ ...first, label: `${label} ${first.label}` }, true)}
      {rest.length ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Other formats"
              className="cursor-pointer rounded-e-md border-s border-border px-1 py-1.5 hover:bg-muted">
              <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1">
            <ul>{rest.map((f) => <li key={f.key}>{row(f)}</li>)}</ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  );
}

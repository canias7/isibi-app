import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
/**
 * The code to quote when you get in touch.
 *
 * ITS ONLY JOB IS TO BE COPIED ACCURATELY, which is why it ships with a copy
 * button rather than expecting somebody to transcribe a 16-character id from a
 * screen. Transcription errors on these are near-universal and each one costs a
 * round trip with support.
 *
 * Monospace and `select-all`, so a tap or a click takes the whole thing rather
 * than a word of it.
 *
 * IT SAYS WHAT THE CODE IS FOR. A bare hex string on an error screen reads as
 * part of the failure; "quote this if you get in touch" makes it an instrument
 * rather than more noise.
 */
export function ErrorReference({ code, note = "Quote this if you get in touch.", className }: {
  code: string; note?: string;
  className?: string;
}) {
  if (!code) return null;
  return (
    <div data-slot="error-reference" className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)}>
      <span>{note}</span>
      <code className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-foreground select-all">{code}</code>
      <CopyButton value={code} label="Copy error reference" iconOnly />
    </div>
  );
}

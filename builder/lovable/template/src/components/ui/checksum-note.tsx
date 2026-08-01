import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
/**
 * The hash, so a download can be verified.
 *
 * IT SAYS WHAT TO DO WITH IT. A bare hex string beside a download is noise to
 * everybody who does not already know the convention — one line naming the
 * command turns it into something a reader can actually act on.
 *
 * THE ALGORITHM IS PART OF THE VALUE, not a caption. A hash quoted without
 * saying whether it is SHA-256 or MD5 cannot be checked, and the two look
 * similar enough at a glance to be confused.
 *
 * `select-all` and a copy button, because transcription of a 64-character hex
 * string is not a thing anybody does correctly.
 */
export function ChecksumNote({ algorithm = "SHA-256", hash, howTo, className }: {
  algorithm?: string;
  hash: string;
  /** "Run: shasum -a 256 the-file" */
  howTo?: string;
  className?: string;
}) {
  if (!hash) return null;
  return (
    <div className={cn("flex flex-col gap-1 text-xs", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{algorithm}</span>
        <code className="max-w-full truncate rounded border border-border bg-muted px-1.5 py-0.5 font-mono select-all">
          {hash}
        </code>
        <CopyButton value={hash} label={`Copy ${algorithm} checksum`} iconOnly />
      </div>
      {howTo && <p className="text-muted-foreground">{howTo}</p>}
    </div>
  );
}

import { cn } from "@/lib/utils";
/**
 * What is inside an archive, before downloading it.
 *
 * THE POINT IS DECIDING WHETHER TO DOWNLOAD AT ALL. A 900 MB zip whose contents
 * are unknown is a gamble on a slow connection, and listing the first few names
 * plus the count answers it in one line.
 *
 * THE UNCOMPRESSED SIZE IS SHOWN ALONGSIDE. People run out of disk unpacking
 * archives far more often than downloading them, and a 200 MB zip that becomes
 * 4 GB is a genuine surprise the download size cannot warn about.
 *
 * Capped with a stated remainder — a full listing of eight hundred files is not
 * a preview, it is the archive.
 */
export function ZipContents({ files, count, packed, unpacked, max = 5, className }: {
  /** The first few names. */
  files: string[];
  /** Total entries. */
  count?: number;
  /** Formatted — "200 MB". */
  packed?: string;
  /** Formatted — "4.1 GB". */
  unpacked?: string;
  max?: number;
  className?: string;
}) {
  if (!files.length) return null;
  const shown = files.slice(0, max);
  const total = count ?? files.length;
  const rest = total - shown.length;
  return (
    <div className={cn("flex flex-col gap-1 text-sm", className)}>
      <p className="text-xs text-muted-foreground tabular-nums">
        {total} {total === 1 ? "file" : "files"}
        {packed ? ` · ${packed} to download` : ""}
        {unpacked ? ` · ${unpacked} unpacked` : ""}
      </p>
      <ul className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
        {shown.map((f) => <li key={f} className="truncate">{f}</li>)}
        {rest > 0 && <li className="tabular-nums">and {rest} more</li>}
      </ul>
    </div>
  );
}

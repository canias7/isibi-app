import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * One version of a file, in a list of them.
 *
 * THE CURRENT ONE IS MARKED AND HAS NO RESTORE CONTROL. A row offering to
 * restore the version already in use is an action that means nothing, and
 * leaving the marker off makes the top row ambiguous — is that live, or the most
 * recent backup?
 *
 * SIZE IS SHOWN PER VERSION, because a version that suddenly halved in size is
 * usually a truncated upload, and it is the only signal of that before somebody
 * opens it.
 *
 * Who and when are required together. "Version 4" is not something anybody can
 * choose between; "Sam, Tuesday, 2.4 MB" is.
 */
export function FileVersion({ label, by, at, size, current, onRestore, onDownload, className }: {
  label: string;
  by?: string;
  at: string | number | Date;
  size?: string;
  current?: boolean;
  onRestore?: () => void;
  onDownload?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 py-2", className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {label}
          {current && <span className="ml-2 font-normal text-muted-foreground">Current</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {by ? `${by} · ` : ""}
          <time dateTime={new Date(at).toISOString()}><DateFormat date={at} withTime /></time>
          {size ? ` · ${size}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-3 text-xs">
        {onDownload && (
          <button type="button" onClick={onDownload} className="cursor-pointer underline underline-offset-2">
            Download<span className="sr-only"> {label}</span>
          </button>
        )}
        {onRestore && !current && (
          <button type="button" onClick={onRestore} className="cursor-pointer underline underline-offset-2">
            Restore<span className="sr-only"> {label}</span>
          </button>
        )}
      </div>
    </div>
  );
}

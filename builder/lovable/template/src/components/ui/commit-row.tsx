import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * One commit in a list.
 *
 * Only the FIRST LINE of the message is shown, with the rest behind a toggle.
 * Commit bodies in this repository run to twenty lines; rendering them inline
 * makes a list of ten commits unscannable, and the subject line is the summary
 * the convention exists to provide.
 *
 * The SHA is shortened to seven characters and monospaced, and it is
 * `select-all` so one click selects the whole thing — copying a sha by dragging
 * across seven characters is a small daily annoyance with a one-word fix.
 *
 * The date is a real `<time datetime>` carrying the ISO value, so a crawler and
 * a screen reader get the exact timestamp while the reader sees "2 days ago".
 * Same rule as `date-format`.
 *
 * A VERIFIED signature is stated in words, not a padlock alone. "Verified" is
 * the claim; a padlock is a symbol people read as "https" and ignore.
 */
export function CommitRow({
  sha, subject, body, author, at, iso, verified, href, stats, className,
}: {
  sha: string;
  subject: React.ReactNode;
  body?: string;
  author?: React.ReactNode;
  at?: React.ReactNode;
  iso?: string;
  verified?: boolean;
  href?: string;
  stats?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={cn("flex flex-col gap-1 py-2", className)}>
      <div className="flex items-baseline gap-2">
        <p className="min-w-0 flex-1 text-sm">
          {href ? (
            <a href={href} className="font-medium hover:underline">{subject}</a>
          ) : (
            <span className="font-medium">{subject}</span>
          )}
          {body ? (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
              className="ml-2 cursor-pointer rounded border border-border px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
              {open ? "less" : "…"}
            </button>
          ) : null}
        </p>
        <code className="shrink-0 font-mono text-xs text-muted-foreground select-all">{sha.slice(0, 7)}</code>
      </div>
      {open && body ? (
        <pre className="rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">{body}</pre>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {author ? <span>{author}</span> : null}
        {at ? (
          <>
            <span aria-hidden>·</span>
            <time dateTime={iso}>{at}</time>
          </>
        ) : null}
        {verified ? (<><span aria-hidden>·</span><span className="font-medium text-foreground">Verified</span></>) : null}
        {stats ? (<><span aria-hidden>·</span>{stats}</>) : null}
      </p>
    </div>
  );
}

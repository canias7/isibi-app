import { AvatarName } from "@/components/ui/avatar-name";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/**
 * What the last shift left for the next one.
 *
 * Stamped with who wrote it and when, always. An unattributed handover note
 * is one nobody can ask about, and an undated one gets read as today's on a
 * Monday morning when it was written on Friday.
 *
 * Open items are a list rather than prose, because that is the part somebody
 * arriving actually acts on.
 */
export function HandoffNote({ author, at, body, open, avatar, className }: {
  author: string; at?: string | number | Date; body?: string;
  open?: string[]; avatar?: string | null; className?: string;
}) {
  return (
    <article data-slot="handoff-note" className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AvatarName name={author} src={avatar} size="sm" avatarOnly />
        <span className="font-medium text-foreground">{author}</span>
        {at && <TimeAgo date={at} />}
      </div>
      {body && <p className="text-sm">{body}</p>}
      {open?.length ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Still open</p>
          <ul className="mt-1 list-disc space-y-0.5 ps-4 text-sm">
            {open.map((o) => <li key={o}>{o}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

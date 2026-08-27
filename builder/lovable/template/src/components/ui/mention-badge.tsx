import * as React from "react";
import { AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "@ada" rendered inside a message, and the marker when it is you.
 *
 * A MENTION OF YOU LOOKS DIFFERENT. That is the entire feature: in a thread of
 * forty messages the one naming you is the one you need, and rendering every
 * mention identically means scanning for your own name by eye.
 *
 * A DELETED OR UNKNOWN person renders as plain text with the raw handle, never
 * as a broken link. `@[user:4821]` leaking into a message is what happens when
 * a mention assumes the person still exists.
 *
 * It is a `<span>` with a title, not an anchor, unless a href is given.
 * A mention that navigates away mid-conversation is rarely what somebody
 * pressing it wants, and a link with nowhere to go is worse.
 *
 * The `@` is part of the text rather than an icon, because it is read aloud
 * correctly and survives being copied — an icon-plus-name copies as a name.
 */
export function MentionBadge({ name, handle, isMe, href, unknown, className }: {
  name?: string;
  handle: string;
  isMe?: boolean;
  href?: string;
  unknown?: boolean;
  className?: string;
}) {
  if (unknown || !name) {
    return <span data-slot="mention-badge" className={cn("text-muted-foreground", className)}>@{handle}</span>;
  }
  const body = (
    <>
      @{name}
      {isMe ? <span className="sr-only"> (you)</span> : null}
    </>
  );
  const shared = cn("rounded px-1 py-0.5 text-sm",
    isMe ? "bg-foreground font-medium text-background" : "bg-muted font-medium", className);
  return href ? (
    <a href={href} title={`@${handle}`} className={cn(shared, "hover:underline")}>{body}</a>
  ) : (
    <span title={`@${handle}`} className={shared}>{body}</span>
  );
}

export function MentionCount({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span data-slot="mention-count" className={cn("inline-flex items-center gap-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background", className)}>
      <AtSign aria-hidden className="size-2.5" />
      <span className="tabular-nums">{count}</span>
      <span className="sr-only">{count === 1 ? "mention of you" : "mentions of you"}</span>
    </span>
  );
}

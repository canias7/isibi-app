import * as React from "react";
import { AvatarName } from "@/components/ui/avatar-name";
import { cn, toDate } from "@/lib/utils";
/**
 * One message in a conversation.
 *
 * `own` flips the side AND the fill. Side alone is not enough — a screen
 * reader hears no side at all — so the author is named in the text for
 * anything not the reader's own, and never as colour by itself.
 */
export function ChatMessage({ body, own, author, at, avatar, status, className }: {
  body: React.ReactNode; own?: boolean; author?: string;
  at?: string | number | Date; avatar?: string | null;
  status?: React.ReactNode; className?: string;
}) {
  const time = at != null && !Number.isNaN(toDate(at).getTime())
    ? toDate(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
  return (
    <div data-slot="chat-message" className={cn("flex gap-2", own ? "flex-row-reverse" : "flex-row", className)}>
      {!own && author && <AvatarName name={author} src={avatar} size="sm" avatarOnly />}
      <div className={cn("flex max-w-[75%] flex-col gap-0.5", own && "items-end")}>
        {!own && author && <span className="px-1 text-xs text-muted-foreground">{author}</span>}
        <div className={cn("rounded-2xl px-3 py-2 text-sm",
          own ? "rounded-ee-sm bg-foreground text-background" : "rounded-es-sm bg-muted")}>
          {body}
        </div>
        <span className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
          {time}{status}
        </span>
      </div>
    </div>
  );
}

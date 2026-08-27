import * as React from "react";
import { Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The follow/unfollow toggle on a document or a thread.
 *
 * IT SAYS WHAT FOLLOWING WILL DO. "Follow" alone leaves people guessing whether
 * it means email, a badge, or a daily digest — and the ones who guess wrong
 * unfollow after the first notification arrives at midnight.
 *
 * AUTOMATIC FOLLOWING IS DISCLOSED. Most systems subscribe you when you comment,
 * and somebody who never pressed anything but is receiving mail has no idea why
 * — so when `auto` is set, it says so and the toggle turns it off explicitly.
 *
 * The button is `aria-pressed`, and the label describes the ACTION when off and
 * the STATE when on — "Follow" versus "Following" — which is the convention
 * that stops people pressing it to check.
 *
 * The count of other followers is shown when known, because on a shared
 * document that is the difference between a note and an announcement.
 */
export function FollowChanges({ following, auto, followers, onToggle, what = "changes", className }: {
  following: boolean;
  auto?: boolean;
  followers?: number;
  onToggle: () => void;
  what?: string;
  className?: string;
}) {
  return (
    <div data-slot="follow-changes" className={cn("flex flex-wrap items-center gap-2", className)}>
      <button type="button" onClick={onToggle} aria-pressed={following}
        className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium",
          following ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
        {following ? <Bell aria-hidden className="size-3.5" /> : <BellOff aria-hidden className="size-3.5" />}
        {following ? "Following" : "Follow"}
      </button>
      <p className="min-w-0 text-xs text-muted-foreground">
        {following
          ? <>You&rsquo;ll be told about {what}.{auto ? " You were followed automatically because you commented." : null}</>
          : <>Get told about {what} here.</>}
        {followers ? <span className="tabular-nums"> {followers} others follow this.</span> : null}
      </p>
    </div>
  );
}

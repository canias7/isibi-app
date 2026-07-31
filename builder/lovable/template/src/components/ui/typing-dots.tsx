import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Ada is typing…"
 *
 * NAMES ARE COLLAPSED SENSIBLY: one name, two names, then "Ada and 3 others".
 * A comma-separated list of six names is longer than most of the messages it
 * sits under, and it changes length constantly as people start and stop.
 *
 * It is `aria-live="off"` by design, with the text present for anyone who
 * navigates to it. Announcing "Ada is typing" then "Ada and Grace are typing"
 * then "Ada is typing" makes a conversation unlistenable — this is ambient,
 * and the message itself will be announced when it arrives.
 *
 * The dots stop for `prefers-reduced-motion` and the text carries it. The
 * animation is decoration on a sentence that already says everything.
 *
 * It renders NOTHING for an empty list, so the caller can leave it mounted and
 * the row does not reserve space for a state that is usually absent.
 */
export function TypingDots({ names, className }: { names: string[]; className?: string }) {
  if (names.length === 0) return null;
  const who = names.length === 1 ? names[0]
    : names.length === 2 ? `${names[0]} and ${names[1]}`
    : `${names[0]} and ${names.length - 1} others`;
  const verb = names.length === 1 ? "is" : "are";

  return (
    <p aria-live="off" className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span aria-hidden className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ animationDelay: `${i * 160}ms` }}
            className="size-1 rounded-full bg-current motion-safe:animate-bounce" />
        ))}
      </span>
      {who} {verb} typing…
    </p>
  );
}

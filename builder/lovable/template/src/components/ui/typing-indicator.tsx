import { cn } from "@/lib/utils";
/**
 * "Ada is typing."
 *
 * The dots are decoration and the SENTENCE is the content — an animation
 * alone says nothing to a screen reader, and `aria-live="polite"` on three
 * bouncing dots would announce nothing repeatedly.
 */
export function TypingIndicator({ who, className }: { who?: string | string[]; className?: string }) {
  const names = who == null ? [] : Array.isArray(who) ? who : [who];
  const text = names.length === 0 ? "Typing"
    : names.length === 1 ? `${names[0]} is typing`
    : names.length === 2 ? `${names[0]} and ${names[1]} are typing`
    : `${names[0]} and ${names.length - 1} others are typing`;
  return (
    <p className={cn("flex items-center gap-2 px-1 text-xs text-muted-foreground", className)} aria-live="polite">
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </span>
      {text}
    </p>
  );
}

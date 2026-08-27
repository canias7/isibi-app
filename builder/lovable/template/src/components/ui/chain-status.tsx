import { cn } from "@/lib/utils";
/**
 * The chain — where it actually stands, which is wherever the slowest link is.
 *
 * THE CHAIN MOVES AT THE SPEED OF ITS SLOWEST LINK AND THE COMPONENT SAYS WHICH
 * ONE THAT IS, BY NAME. Everybody in a chain believes they are waiting on
 * somebody unspecified; naming the link is the single most useful thing this can
 * do, and it is almost never on the screen.
 *
 * THE LENGTH IS SHOWN BOTH WAYS. Two above and four below is a very different
 * risk from six below, and one number hides which end the danger is at.
 *
 * A BREAK IS SHOWN WHERE IT HAPPENED, not as a failed chain. Everything below a
 * break is unaffected and frequently does not know it; showing the position lets
 * the people who can still proceed proceed.
 *
 * NO PROBABILITY OF COMPLETION. It would be a made-up number about other
 * people's finances, presented to somebody making the largest decision of their
 * life.
 */
export type ChainLink = {
  id: string;
  who: string;
  /** What this link is waiting on. */
  waitingOn?: string;
  ready?: boolean;
  /** True where this link has fallen through. */
  broken?: boolean;
};

export function ChainStatus({ above = [], below = [], you = "You", className }: {
  /** Nearest first. */
  above?: ChainLink[];
  below?: ChainLink[];
  you?: string;
  className?: string;
}) {
  const all = [...above, ...below];
  const broken = all.find((l) => l.broken);
  const slowest = all.find((l) => !l.ready && !l.broken);
  return (
    <div data-slot="chain-status" className={cn("space-y-1.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">
          {above.length} above, {below.length} below
        </span>
        <span className="text-muted-foreground"> · {all.length + 1} in the chain</span>
      </p>
      {broken ? (
        <p className="font-medium">
          Broken at {broken.who}. Everything below that point is unaffected and can still proceed.
        </p>
      ) : slowest ? (
        <p className="font-medium">
          Everybody is waiting on {slowest.who}
          {slowest.waitingOn ? `, who is waiting on ${slowest.waitingOn}` : ""}.
        </p>
      ) : (
        <p className="text-muted-foreground">Every link is ready.</p>
      )}
      <ol className="divide-y divide-border rounded-md border border-border">
        {above.map((l) => (
          <Link key={l.id} link={l} side="above" />
        ))}
        <li className="px-3 py-1.5 text-sm font-medium">{you}</li>
        {below.map((l) => (
          <Link key={l.id} link={l} side="below" />
        ))}
      </ol>
    </div>
  );
}

function Link({ link, side }: { link: ChainLink; side: "above" | "below" }) {
  return (
    <li className="flex items-baseline gap-3 px-3 py-1.5 text-sm">
      <span className="min-w-0 flex-1">
        {link.who}
        <span className="block text-xs text-muted-foreground">
          {[side, link.waitingOn && `waiting on ${link.waitingOn}`].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className={cn("shrink-0 text-xs", link.ready && !link.broken ? "text-muted-foreground" : "font-medium")}>
        {link.broken ? "Fallen through" : link.ready ? "Ready" : "Not ready"}
      </span>
    </li>
  );
}

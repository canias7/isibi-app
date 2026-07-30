import { cn } from "@/lib/utils";

/**
 * A strip that scrolls forever.
 *
 * CSS only. Every registry that sells one of these ships `motion` with it, which
 * is ~50 KB of animation runtime in a bundle for an effect two keyframes do.
 *
 * Stops for `prefers-reduced-motion`, because continuous movement is a genuine
 * accessibility problem rather than a preference.
 */
export function Marquee({ items, speed = 30, className }: {
  items: React.ReactNode[];
  /** Seconds for one full pass. */
  speed?: number;
  className?: string;
}) {
  const row = [...items, ...items];
  return (
    <div className={cn("group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]", className)}>
      <style>{`@keyframes isibi-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @media (prefers-reduced-motion:reduce){.isibi-marquee{animation:none!important}}`}</style>
      <div className="isibi-marquee flex w-max gap-10 group-hover:[animation-play-state:paused]"
        style={{ animation: `isibi-marquee ${speed}s linear infinite` }}>
        {row.map((c, i) => <div key={i} className="shrink-0">{c}</div>)}
      </div>
    </div>
  );
}

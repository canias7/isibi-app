import * as React from "react";
import { Button } from "@/components/ui/button";
import type { HeroAction } from "@/components/ui/hero";
import { cn } from "@/lib/utils";
/**
 * A hero with a moving background. The immersive top-of-page.
 *
 * Four attributes carry it and each is load-bearing: `muted` because autoplay
 * is only permitted without sound and the video simply will not start
 * otherwise, `playsInline` because iOS takes an un-flagged video FULLSCREEN
 * over the page, `loop` because a background that stops on a frozen frame
 * reads as broken, and no `controls` because this is decoration — it is
 * `aria-hidden`, and a control a keyboard cannot reach is worse than none.
 *
 * `prefers-reduced-motion` gets the POSTER and the video never loads. Not a
 * nicety: a full-bleed moving image is the exact thing that setting exists for,
 * and it also saves the download.
 *
 * The poster carries every failure — no `src`, still loading, wrong codec, a
 * blocked request. It is what is painted underneath at all times, so there is
 * no state in which this renders a black box.
 *
 * A scrim sits between the video and the words, because text over an arbitrary
 * frame of arbitrary footage is unreadable at SOME point in the loop, and the
 * point of a loop is that it reaches every frame. `overlay` tunes it.
 */
export function VideoHero({
  title, subtitle, src, poster, primary, secondary, overlay = 55, align = "center", className,
}: {
  title: string;
  subtitle?: string;
  /** Muted looping footage. Omit and the poster stands alone. */
  src?: string | null;
  /** Shown under the video, and INSTEAD of it on reduced motion or any failure. */
  poster?: string | null;
  primary?: HeroAction;
  secondary?: HeroAction;
  /** Scrim strength, 0-100. Raise it over busy footage. */
  overlay?: number;
  align?: "left" | "center";
  className?: string;
}) {
  const [still, setStill] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const apply = () => setStill(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  const [failed, setFailed] = React.useState(false);
  const moving = !!src && !still && !failed;

  return (
    <section className={cn("relative isolate overflow-hidden", className)}>
      <div className="absolute inset-0 -z-10 bg-muted">
        {poster ? (
          <img src={poster} alt="" aria-hidden className="size-full object-cover" />
        ) : null}
        {moving ? (
          <video
            key={src}
            src={src ?? undefined}
            poster={poster ?? undefined}
            autoPlay muted loop playsInline
            aria-hidden tabIndex={-1}
            onError={() => setFailed(true)}
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-background"
          style={{ opacity: Math.min(Math.max(overlay, 0), 100) / 100 }} />
      </div>
      <div className={cn("mx-auto flex max-w-4xl flex-col gap-5 px-6 py-24 sm:py-36",
        align === "center" && "items-center text-center")}>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{title}</h1>
        {subtitle && <p className="max-w-2xl text-lg text-muted-foreground text-balance">{subtitle}</p>}
        {(primary || secondary) && (
          <div className="mt-2 flex flex-wrap gap-3">
            {primary && (
              <Button size="lg" asChild={!!primary.href} onClick={primary.onClick}>
                {primary.href ? <a href={primary.href}>{primary.label}</a> : <span>{primary.label}</span>}
              </Button>
            )}
            {secondary && (
              <Button size="lg" variant="outline" asChild={!!secondary.href} onClick={secondary.onClick}>
                {secondary.href ? <a href={secondary.href}>{secondary.label}</a> : <span>{secondary.label}</span>}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

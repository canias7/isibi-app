import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A tiny blurred placeholder that sharpens into the real photograph.
 *
 * The placeholder is a DATA URI, inline in the markup. A second URL would be a
 * second request that has to finish before the placeholder appears, by which
 * time the real image is often already there — so the whole technique buys
 * nothing. A 20px JPEG is a few hundred bytes of base64 and arrives with the
 * HTML.
 *
 * It is BLURRED and SCALED UP past the edges, because a 20px image enlarged has
 * visible colour fringing at its border; the scale pushes that outside the clip.
 *
 * The placeholder is removed on load AND on error. Left on error, a broken
 * image URL leaves a permanently blurred smear that looks like a page still
 * loading — the state people wait through rather than report.
 *
 * `width`/`height` are required, same as `progressive-image`: the ratio has to
 * be known before anything arrives or the page still shifts, blur or no blur.
 */
export function BlurUp({
  src, placeholder, alt, width, height, priority, className, ...rest
}: {
  src: string;
  placeholder: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
} & Omit<React.ComponentProps<"img">, "src" | "alt" | "width" | "height" | "className">) {
  const [done, setDone] = React.useState(false);
  const ref = React.useRef<HTMLImageElement>(null);

  // An image restored from cache can finish before React attaches onLoad, which
  // leaves the blur up forever on a second visit.
  React.useEffect(() => { if (ref.current?.complete) setDone(true); }, []);

  return (
    <div style={{ aspectRatio: `${width} / ${height}` }}
      className={cn("relative overflow-hidden bg-muted", className)}>
      {!done ? (
        <img src={placeholder} alt="" aria-hidden
          className="absolute inset-0 size-full scale-110 object-cover blur-lg" />
      ) : null}
      <img
        {...rest}
        ref={ref}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        onLoad={() => setDone(true)}
        onError={() => setDone(true)}
        className={cn("relative block size-full object-cover transition-opacity duration-(--dur-4) motion-reduce:transition-none",
          done ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An image that reserves its space and does not shift the page when it lands.
 *
 * `width` and `height` are REQUIRED, and that is the whole point. Given both,
 * the browser computes the aspect ratio and holds the space before a single
 * byte arrives; without them everything below jumps down when the picture
 * loads, which is the single largest source of layout shift on a content page —
 * and the thing that makes somebody tap the wrong link.
 *
 * They are the image's INTRINSIC dimensions, not the display size. CSS still
 * decides how big it is; these only supply the ratio.
 *
 * `loading="lazy"` and `decoding="async"` by default, with `priority` to turn
 * both off — the one image above the fold should never be lazy, because lazy
 * loading the thing already in view delays it for no benefit. `fetchPriority`
 * goes with it.
 *
 * A failed load falls back rather than leaving a broken-image icon, for the
 * same reason `safe-image` exists: on a fresh site these URLs are filled in by
 * the owner afterwards and are routinely empty.
 */
export function ProgressiveImage({
  src, alt, width, height, priority, sizes, srcSet, fallback, className, ...rest
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  fallback?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"img">, "src" | "alt" | "width" | "height" | "className">) {
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  if (!src || failed) {
    return (
      <div style={{ aspectRatio: `${width} / ${height}` }}
        className={cn("flex w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground", className)}>
        {fallback ?? null}
      </div>
    );
  }
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      srcSet={srcSet}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : undefined}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={cn("block h-auto w-full bg-muted transition-opacity duration-(--dur-3) motion-reduce:transition-none",
        loaded ? "opacity-100" : "opacity-0", className)}
    />
  );
}

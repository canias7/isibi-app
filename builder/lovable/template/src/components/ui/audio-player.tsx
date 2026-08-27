import { cn } from "@/lib/utils";
/**
 * A sound file.
 *
 * The browser's own controls rather than a hand-built transport: they are
 * keyboard operable, screen-reader labelled and familiar, and a custom one
 * usually is none of those.
 */
export function AudioPlayer({ src, title, className }: {
  src: string; title?: string; className?: string;
}) {
  return (
    <div data-slot="audio-player" className={cn("flex flex-col gap-2 rounded-lg border p-3", className)}>
      {title && <span className="text-sm font-medium">{title}</span>}
      <audio controls preload="none" src={src} className="w-full">
        Your browser can&apos;t play this file. <a href={src} className="underline">Download it instead</a>.
      </audio>
    </div>
  );
}

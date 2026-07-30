import { cn } from "@/lib/utils";
/**
 * A YouTube or Vimeo video, from whatever URL somebody pasted.
 *
 * Uses the privacy-preserving hosts (`youtube-nocookie`, Vimeo with `dnt`), so a
 * small business's site does not drop a tracking cookie on every visitor who
 * never pressed play.
 */
export function VideoEmbed({ url, title = "Video", ratio = "16/9", className }: {
  url: string; title?: string; ratio?: string; className?: string;
}) {
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}`
            : vm ? `https://player.vimeo.com/video/${vm[1]}?dnt=1` : null;
  if (!src) {
    return (
      <div className={cn("grid place-items-center rounded-lg bg-muted text-xs text-muted-foreground", className)}
        style={{ aspectRatio: ratio }}>Video unavailable</div>
    );
  }
  return (
    <div className={cn("overflow-hidden rounded-lg bg-muted", className)} style={{ aspectRatio: ratio }}>
      <iframe src={src} title={title} loading="lazy" allowFullScreen
        allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
        className="size-full border-0" />
    </div>
  );
}

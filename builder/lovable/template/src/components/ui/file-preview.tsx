import * as React from "react";
import { FileText, File as FileIcon, FileArchive, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Show a file as itself — except the kinds that are secretly documents.
 *
 * SVG AND HTML NEVER RENDER INLINE. An SVG is a document that can carry
 * script (the site-uploads stored-XSS lesson) and an HTML "preview" is
 * just running the file; both get the icon-and-metadata card no matter
 * what their type claims. Everything else previews as its honest self:
 * image, video (preload=metadata), audio, plain text as a clipped
 * snippet.
 *
 * NAME, SIZE AND TYPE ALWAYS SHOW, on every branch — the preview
 * answers "is this the right file", and for two photos named alike the
 * size is the only tell.
 *
 * Object URLs are the caller's when a URL is passed; when given a File,
 * this component mints and revokes its own (attachment-tray rule).
 */
function fmtSize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function FilePreview({ file, url, className }: {
  file: { name: string; size?: number; type?: string };
  /** Pass a URL for hosted files; a real File mints its own. */
  url?: string;
  className?: string;
}) {
  const [minted, setMinted] = React.useState<string | null>(null);
  const isRealFile = typeof File !== "undefined" && file instanceof File;
  React.useEffect(() => {
    if (!isRealFile || url) return;
    const u = URL.createObjectURL(file as File);
    setMinted(u);
    return () => URL.revokeObjectURL(u);
  }, [file, url, isRealFile]);

  const src = url ?? minted ?? undefined;
  const type = (file.type ?? "").toLowerCase();
  const name = file.name.toLowerCase();
  // Documents in disguise: never inline, whatever they claim to be.
  const dangerous = type.includes("svg") || type.includes("html") || /\.(svg|html?)$/.test(name);

  const meta = (
    <p className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
      <span className="min-w-0 truncate font-medium text-foreground">{file.name}</span>
      {file.size != null ? <span className="shrink-0 tabular-nums">{fmtSize(file.size)}</span> : null}
      {file.type ? <span className="shrink-0">{file.type}</span> : null}
    </p>
  );

  let body: React.ReactNode;
  if (dangerous || !src) {
    const Icon = /zip|tar|gz/.test(type + name) ? FileArchive
      : /csv|sheet|excel/.test(type + name) ? FileSpreadsheet
      : /text|json/.test(type) ? FileText : FileIcon;
    body = (
      <div className="flex h-20 items-center justify-center rounded-md border border-border bg-muted/40">
        <Icon className="size-7 text-muted-foreground" aria-hidden />
      </div>
    );
  } else if (type.startsWith("image/")) {
    body = <img src={src} alt={file.name} className="max-h-36 rounded-md border border-border" />;
  } else if (type.startsWith("video/")) {
    body = <video src={src} controls preload="metadata" className="max-h-36 rounded-md border border-border" />;
  } else if (type.startsWith("audio/")) {
    body = <audio src={src} controls className="w-full" />;
  } else {
    body = (
      <div className="flex h-20 items-center justify-center rounded-md border border-border bg-muted/40">
        <FileIcon className="size-7 text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <figure className={cn("flex max-w-xs flex-col gap-1.5", className)}>
      {body}
      <figcaption>{meta}</figcaption>
    </figure>
  );
}

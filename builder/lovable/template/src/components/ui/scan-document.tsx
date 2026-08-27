import * as React from "react";
import { CameraCapture } from "@/components/ui/camera-capture";
import { cn } from "@/lib/utils";
/**
 * Photograph a document and make it READ like a scan.
 *
 * THE "SCAN LOOK" IS A CSS FILTER, TOGGLEABLE, AND HONEST ABOUT IT:
 * grayscale + contrast + brightness makes a receipt legible and small,
 * and the toggle exists because a stamped colour logo sometimes IS the
 * point. What this deliberately does NOT do is perspective correction —
 * a deskew needs an OpenCV wasm at ~8MB, shipped to every visitor of a
 * barber shop's site to straighten one receipt (the code-block/no-shiki
 * family of refusal). The framing guide does the cheap 80%: hold the
 * phone square.
 *
 * The OUTPUT is the treated bitmap, re-encoded from a canvas — a filter
 * only the preview can see would be a lie the upload does not carry
 * (the curl-example masked-on-screen rule, inverted: here what you see
 * must be what you send).
 */
export function ScanDocument({ onScan, className }: {
  onScan: (file: File) => void;
  className?: string;
}) {
  const [raw, setRaw] = React.useState<File | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [treated, setTreated] = React.useState(true);
  React.useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const finish = async () => {
    if (!raw) return;
    if (!treated) { onScan(raw); return; }
    // Bake the treatment in: the preview and the upload must agree.
    const img = new Image();
    img.src = url!;
    await new Promise((r) => { img.onload = r; });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx2 = canvas.getContext("2d")!;
    ctx2.filter = "grayscale(1) contrast(1.4) brightness(1.1)";
    ctx2.drawImage(img, 0, 0);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    onScan(blob ? new File([blob], raw.name.replace(/\.\w+$/, "") + "-scan.jpg", { type: "image/jpeg" }) : raw);
  };

  return (
    <div data-slot="scan-document" className={cn("flex flex-col gap-2", className)}>
      {!raw ? (
        <div className="flex flex-col gap-1.5">
          <div aria-hidden className="flex h-28 w-44 items-center justify-center rounded-lg border-2 border-dashed border-border">
            <div className="h-20 w-32 rounded-sm border border-border bg-muted/50 text-center text-[10px] leading-[5rem] text-muted-foreground">
              fill the frame
            </div>
          </div>
          <CameraCapture label="Scan a document" onPhoto={(f) => {
            setRaw(f);
            setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
          }} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <img src={url!} alt="The captured document"
            className={cn("max-h-44 self-start rounded-md border border-border", treated && "brightness-110 contrast-[1.4] grayscale")} />
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input type="checkbox" checked={treated} onChange={(e) => setTreated(e.target.checked)}
              className="size-3.5 cursor-pointer accent-foreground" />
            Scan look (grayscale, higher contrast) — what you see is what uploads
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={finish}
              className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              Use this
            </button>
            <button type="button" onClick={() => { setRaw(null); if (url) { URL.revokeObjectURL(url); setUrl(null); } }}
              className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm">
              Retake
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import * as React from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Take a photo — through the OS camera, on purpose.
 *
 * `<input capture>`, NOT getUserMedia. The OS camera app has focus, HDR,
 * torch, flip and ten years of tuning; a getUserMedia preview has a
 * permission prompt and none of that. For "photograph the haircut /
 * the receipt", the input attribute opens the real camera on phones and
 * a file dialog on desktops — both of which are exactly right, for zero
 * permission ceremony. The live-preview route earns its complexity only
 * for continuous capture (barcode scanning), which is not this
 * component.
 *
 * `facing` picks the camera: "environment" (the world) for receipts and
 * chairs, "user" for faces. The preview confirms WHAT WAS TAKEN — the
 * moment people distrust most — with retake beside it; the object URL is
 * revoked on replace and unmount.
 */
export function CameraCapture({ facing = "environment", onPhoto, label = "Take a photo", className }: {
  facing?: "environment" | "user";
  onPhoto: (file: File) => void;
  label?: React.ReactNode;
  className?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      {preview ? (
        <div className="flex flex-col gap-1.5">
          <img src={preview} alt="The photo just taken" className="max-h-40 rounded-lg border border-border" />
          <button type="button" onClick={() => input.current?.click()}
            className="cursor-pointer self-start text-xs underline underline-offset-2">
            Retake
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          <Camera className="size-4" aria-hidden /> {label}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" capture={facing} className="sr-only" tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
          onPhoto(f);
          e.target.value = "";
        }} />
    </div>
  );
}

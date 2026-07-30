import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pick a picture, or drop one.
 *
 * Hands the File to the caller and holds no opinion about where it goes — the
 * upload lives in the data layer. A drop zone with no visible button is
 * unusable on a phone, so there is always a button.
 */
export function FileDrop({
  onFile, accept = "image/*", busy, hint = "PNG or JPEG, up to 2 MB", className,
}: {
  onFile: (file: File) => void;
  accept?: string;
  busy?: boolean;
  hint?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const take = (fl: FileList | null) => { const f = fl && fl[0]; if (f) onFile(f); };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center",
        over && "border-foreground bg-muted/50", className)}
    >
      {busy ? <Spinner /> : <Upload className="size-5 text-muted-foreground" />}
      <p className="text-sm text-muted-foreground">Drop a file here, or</p>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
        Choose a file
      </Button>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

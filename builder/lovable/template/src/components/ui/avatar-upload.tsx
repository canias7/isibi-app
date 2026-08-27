import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Change a picture.
 *
 * Previews from the chosen File immediately rather than waiting for an upload to
 * come back, so the change feels instant. The object URL is revoked on unmount.
 */
export function AvatarUpload({ src, name = "", onFile, busy, className }: {
  src?: string | null; name?: string; onFile: (f: File) => void; busy?: boolean; className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div data-slot="avatar-upload" className={cn("flex items-center gap-4", className)}>
      <Avatar className="size-16">
        {(preview || src) && <AvatarImage src={preview || src || ""} alt={name} />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Uploading…" : "Change picture"}
      </Button>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f) { setPreview(URL.createObjectURL(f)); onFile(f); }
          e.target.value = "";
        }} />
    </div>
  );
}

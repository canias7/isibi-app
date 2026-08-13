import { useId } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Taking a theme out, in a format something else can read.
 *
 * IT SAYS WHAT THE FILE IS FOR. A JSON theme moves between workspaces; a CSS
 * custom-property block goes into somebody's own stylesheet — and offering
 * "export" with no explanation gets the wrong one downloaded and a support
 * question about why it will not import.
 *
 * IT LISTS WHAT IS NOT INCLUDED, which is where theme exports disappoint.
 * Uploaded logos are files rather than values, so they nearly always stay
 * behind — and somebody importing a theme into a new workspace expects the
 * whole brand and gets colours.
 *
 * THE VERSION IS IN THE FILE AND SAID HERE. A theme exported a year ago and
 * imported today has to be interpreted somehow, and a format with no version
 * can only be guessed at.
 *
 * NO DOWNLOAD LOGIC. The caller owns the blob and the filename — a component
 * that manufactures a download link cannot be reused for copy-to-clipboard or
 * for saving to an account.
 */
export function ThemeExport({ formats, format, onFormatChange, onExport, excluded = [], version, busy, className }: {
  formats: { id: string; label: string; forWhat: string }[];
  format: string;
  onFormatChange: (id: string) => void;
  onExport: () => void;
  /** What the file will not carry — "your uploaded logo". */
  excluded?: string[];
  version?: string;
  busy?: boolean;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const chosen = formats.find((f) => f.id === format);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <label htmlFor={uid + "-te-format"} className="block text-sm font-medium">Format</label>
        <NativeSelect id={uid + "-te-format"} value={format} className="w-auto"
          onChange={(e) => onFormatChange(e.target.value)}>
          {formats.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </NativeSelect>
        {chosen && <p className="text-xs text-muted-foreground">{chosen.forWhat}</p>}
      </div>
      {excluded.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Not included: {excluded.join(", ")} — {excluded.length === 1 ? "it is a file" : "these are files"} rather than
          a setting, so you will need to upload {excluded.length === 1 ? "it" : "them"} again.
        </p>
      )}
      {version && <p className="text-xs text-muted-foreground">Format version {version}.</p>}
      <Button type="button" size="sm" onClick={onExport} disabled={busy}>
        {busy ? "Preparing…" : "Export"}
      </Button>
    </div>
  );
}

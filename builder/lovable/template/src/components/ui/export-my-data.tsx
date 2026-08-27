import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Downloading your own data, in a format something else can read.
 *
 * IT LISTS WHAT IS IN THE EXPORT, checkable. "Export your data" produces a file
 * whose completeness nobody can judge — and the most important question about a
 * data export is what it LEFT OUT. Naming the parts, with the ones that cannot
 * be included marked and explained, is the whole value.
 *
 * FORMAT IS A CHOICE BECAUSE THE TWO AUDIENCES DIFFER. JSON is for moving into
 * another system; CSV is for somebody who wants to open it in a spreadsheet and
 * look. Offering only one serves half the people who ask.
 *
 * THE EXPORT MAY TAKE TIME AND IT SAYS SO BEFORE THE CLICK. A button that
 * appears to do nothing for ninety seconds gets pressed four times, and each
 * press is a full export job on somebody's server.
 *
 * NO EMAIL-ONLY DELIVERY assumed — the caller decides. Forcing a download
 * through an emailed link is a second account to have access to.
 */
export type ExportPart = { key: string; label: string; note?: string; unavailable?: boolean; reason?: string };

export function ExportMyData({ parts, formats = ["json", "csv"], onExport, busy, estimate, className }: {
  parts: ExportPart[];
  formats?: string[];
  onExport: (v: { parts: string[]; format: string }) => void;
  busy?: boolean;
  /** Free text — "a few minutes". */
  estimate?: string;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const available = parts.filter((p) => !p.unavailable);
  const [picked, setPicked] = useState<string[]>(available.map((p) => p.key));
  const [format, setFormat] = useState(formats[0] ?? "json");
  return (
    <div data-slot="export-my-data" className={cn("space-y-3", className)}>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">What to include</legend>
        {parts.map((p) => (
          <label key={p.key} className={cn("flex items-start gap-2 text-sm", p.unavailable && "opacity-60")}>
            <input type="checkbox" disabled={p.unavailable} checked={picked.includes(p.key)}
              onChange={(e) => setPicked((k) => e.target.checked ? [...k, p.key] : k.filter((x) => x !== p.key))}
              className="mt-0.5 size-4 accent-foreground" />
            <span className="min-w-0">
              {p.label}
              {(p.note || p.reason) && (
                <span className="block text-xs text-muted-foreground">
                  {p.unavailable ? (p.reason ?? "Cannot be exported") : p.note}
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="space-y-1">
        <label htmlFor={uid + "-export-format"} className="block text-sm font-medium">Format</label>
        <NativeSelect id={uid + "-export-format"} value={format} className="w-auto"
          onChange={(e) => setFormat(e.target.value)}>
          {formats.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </NativeSelect>
      </div>
      {estimate && <p className="text-xs text-muted-foreground">This usually takes {estimate}.</p>}
      <Button type="button" disabled={!picked.length || busy} onClick={() => onExport({ parts: picked, format })}>
        {busy ? "Preparing…" : "Export"}
      </Button>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
/**
 * "Download a template" — the blank CSV with the right headers in it.
 *
 * Built in the browser from the same field list the mapper uses, so the
 * template can never drift from what the import expects. A downloadable file
 * kept somewhere else goes stale the first time a field is added.
 *
 * An example row is included and commented as such in the first cell,
 * because a file of bare headers leaves people guessing at date and phone
 * formats.
 */
function csvCell(v: string) {
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
export function TemplateDownload({ fields, fileName = "import-template.csv", example, label = "Download a template", className }: {
  fields: { key: string; label: string }[];
  fileName?: string; example?: Record<string, string>; label?: string; className?: string;
}) {
  const download = () => {
    const header = fields.map((f) => csvCell(f.label)).join(",");
    const rows = [header];
    if (example) rows.push(fields.map((f) => csvCell(example[f.key] ?? "")).join(","));
    const url = URL.createObjectURL(new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button type="button" size="sm" variant="ghost" onClick={download} className={className}>
      <Download className="size-4" />{label}
    </Button>
  );
}

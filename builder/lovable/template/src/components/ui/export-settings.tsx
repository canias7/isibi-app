import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Export settings to a file — and say what does NOT ride along.
 *
 * SECRETS NEVER EXPORT. The classic leak: "export settings" quietly includes
 * an API key, the file lands in a pastebin or a support ticket, and the
 * credential is public. The component takes `values` (what to write) and
 * `excluded` (what was deliberately left out) SEPARATELY, and prints the
 * excluded names — the person exporting deserves to know the file is safe
 * to hand over, and the person coding the caller is forced to decide which
 * list each value is on.
 *
 * THE FILENAME CARRIES THE DATE (settings-2026-07-31.json) because these
 * files pile up in Downloads, and "which one is current" is otherwise
 * answered by mtime archaeology.
 *
 * Download via a Blob URL, revoked after — the attachment-tray rule.
 */
export function ExportSettings({ values, excluded = [], filename, className }: {
  values: Record<string, unknown>;
  excluded?: string[];
  filename?: string;
  className?: string;
}) {
  const save = () => {
    const date = new Date().toISOString().slice(0, 10);
    const name = filename ?? `settings-${date}.json`;
    const blob = new Blob([JSON.stringify(values, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const count = Object.keys(values).length;
  return (
    <div data-slot="export-settings" className={cn("flex flex-col gap-1", className)}>
      <button type="button" onClick={save}
        className="cursor-pointer self-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
        Download settings ({count})
      </button>
      {excluded.length ? (
        <p className="text-xs text-muted-foreground">
          Never included: {excluded.join(", ")} — safe to share.
        </p>
      ) : null}
    </div>
  );
}

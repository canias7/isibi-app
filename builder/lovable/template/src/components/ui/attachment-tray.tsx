import * as React from "react";
import { X, FileText, Image as ImageIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The files attached to a prompt, sitting above the box.
 *
 * A FAILED attachment stays in the tray with its reason. Removing it silently
 * means somebody sends a question about a document that was never uploaded and
 * gets a confident answer about nothing — the worst outcome available here, and
 * the one that happens when upload errors are only a toast that has since gone.
 *
 * Each chip has its own remove button and its own progress, because attachments
 * fail one at a time and a single "uploading…" for the group hides which.
 *
 * The object URL for an image preview is REVOKED when the chip goes. Left
 * behind, every attachment in a long session holds its whole file in memory
 * until the tab is closed.
 *
 * A size is printed on each one. The limit that rejects a file is almost always
 * a size, and knowing which of four files is the 40 MB one is what makes it
 * fixable.
 */
export function formatBytes(n: number) {
  if (!Number.isFinite(n) || n < 0) return "";
  const units = ["B", "kB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function AttachmentTray({ items, onRemove, className }: {
  items: { id: string; name: string; bytes?: number; kind?: "image" | "file"; previewUrl?: string; progress?: number; error?: React.ReactNode }[];
  onRemove: (id: string) => void;
  className?: string;
}) {
  // Revoke a preview URL once its chip has gone, or every attachment in a long
  // session holds its file in memory for the life of the tab.
  const seen = React.useRef(new Map<string, string>());
  React.useEffect(() => {
    const live = new Set(items.map((i) => i.id));
    for (const [id, url] of seen.current) {
      if (!live.has(id)) { URL.revokeObjectURL(url); seen.current.delete(id); }
    }
    for (const i of items) if (i.previewUrl?.startsWith("blob:")) seen.current.set(i.id, i.previewUrl);
  }, [items]);
  React.useEffect(() => {
    const map = seen.current;
    return () => { for (const url of map.values()) URL.revokeObjectURL(url); map.clear(); };
  }, []);

  if (items.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {items.map((a) => (
        <li key={a.id}
          className={cn("flex max-w-56 items-center gap-2 rounded-lg border px-2 py-1.5",
            a.error ? "border-foreground" : "border-border")}>
          {a.previewUrl ? (
            <img src={a.previewUrl} alt="" className="size-7 shrink-0 rounded object-cover" />
          ) : a.error ? (
            <AlertCircle aria-hidden className="size-4 shrink-0" />
          ) : a.kind === "image" ? (
            <ImageIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{a.name}</span>
            <span className="block text-[11px] text-muted-foreground">
              {a.error ? <span className="font-medium text-foreground">{a.error}</span>
                : a.progress != null && a.progress < 1 ? `${Math.round(a.progress * 100)}%`
                : a.bytes != null ? formatBytes(a.bytes) : null}
            </span>
          </span>
          <button type="button" onClick={() => onRemove(a.id)} aria-label={`Remove ${a.name}`}
            className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X aria-hidden className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
